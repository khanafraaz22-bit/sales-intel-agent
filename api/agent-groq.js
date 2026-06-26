// Groq backend — Brave search (grounding) + llama JSON mode (formatting).
//
// PIPELINE:
//   STAGE 1 (Brave, server-side): once per company, fetch real web context via
//     Brave's LLM Context endpoint (api/_brave.js). The shared Brave key lives
//     in process.env.BRAVE_API_KEY — never exposed to the browser. The brief is
//     returned to the client (BRIEF sentinel) and reused for sections 2..11, so
//     Brave is called only ONCE per company.
//
//   STAGE 2 (Groq llama-3.3-70b + json_object): formats the brief into a
//     guaranteed-valid JSON block. json_object mode means no malformed-JSON
//     failures; Brave returns small controllable context so no 413.
//
//   If BRAVE_API_KEY is absent, search is skipped and llama generates from its
//   own knowledge (degraded accuracy, but still works).
//
// Request body (from useAgent.js):
//   { groqKey, company, industry?, region?,
//     blockType, requirement, stepNumber, stepTitle, isLast, searchBrief? }
//
// Response (plain text block + optional BRIEF sentinel on section 1):
//   STEP_NUMBER / STEP_TITLE / THOUGHT / BLOCK_TYPE / BLOCK_DATA / STATUS

import { braveCompanyBrief, isBraveConfigured } from "./_brave.js";
import { getUserId, checkLimit, commitUsage, isLimitConfigured } from "./_limit.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const FORMAT_MODEL = "llama-3.3-70b-versatile"; // JSON mode (json_object)
const MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 8000;

// Sentinels (must match streamParser.js / useAgent.js)
const SEARCH_SENTINEL = "\u0000SEARCH\u0000";
const ERROR_SENTINEL = "\u0000ERROR\u0000";
const BRIEF_SENTINEL = "\u0000BRIEF\u0000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const looksLikeGroqKey = (k) => typeof k === "string" && k.trim().length >= 20;

// ── JSON schema description per block type (Groq json_object mode wants the
//    schema described in-prompt). ──
const BLOCK_SCHEMAS = {
  HERO: `{"company_name":string,"industry":string,"region":string,"growth_stage":string,"key_insight":string,"sales_angle":string,"key_locations":[string,...]} (key_locations: 4-8 entries "City, Country")`,
  METRICS: `{"items":[{"label":string,"value":string,"signal":"positive"|"neutral"|"negative"}]}`,
  CARD_GRID: `{"cards":[{"title":string,"bullets":[string,...]}]}`,
  TABLE: `{"columns":[string,...],"rows":[{"cells":[string,...]}]}`,
  PAIN_POINTS: `{"points":[{"title":string,"description":string,"severity":"high"|"medium"|"low"}]}`,
  INSIGHTS: `{"insights":[string,...]}`,
  SOLUTIONS: `{"solutions":[{"name":string,"problem_solved":string,"impact":string}]}`,
  PERSONAS: `{"personas":[{"role":string,"focus":string,"motivation":string,"objection":string}]}`,
  ROADMAP: `{"phases":[{"phase":string,"actions":[string,...]}]}`,
};

async function fetchWithRetry(body, key, onWait) {
  let attempt = 0;
  while (true) {
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    // 429 (rate) and 413 (too large) both clear after the per-minute window;
    // back off and retry both.
    const isRateLike = resp.status === 429 || resp.status === 413;
    if (!isRateLike || attempt >= MAX_RETRIES) return resp;
    const ra = resp.headers.get("retry-after");
    let waitMs = ra ? Math.ceil(parseFloat(ra) * 1000) : DEFAULT_BACKOFF_MS;
    if (!Number.isFinite(waitMs) || waitMs <= 0) waitMs = DEFAULT_BACKOFF_MS;
    waitMs = Math.min(waitMs + 500, 60000);
    attempt++;
    if (onWait) onWait(waitMs, attempt);
    await sleep(waitMs);
  }
}

// ── Generate ONE block as guaranteed-valid JSON. If `brief` is provided (future
//    Brave integration), it's used as factual grounding; otherwise the model
//    relies on its training knowledge. ──
async function runFormat({ company, industry, region, blockType, requirement, brief }, key) {
  const schema = BLOCK_SCHEMAS[blockType];
  if (!schema) throw new Error(`Unknown block type: ${blockType}`);

  const grounding = brief
    ? `Use the RESEARCH BRIEF as your source of facts:\n${brief}\n\n`
    : `Use your knowledge of ${company}. If you are uncertain about a specific fact, give a reasonable industry-typical estimate rather than inventing precise figures.\n\n`;

  const ctx = [
    industry && industry !== "Unknown" ? `Industry: ${industry}` : null,
    region && region !== "Global" ? `Region: ${region}` : null,
  ].filter(Boolean).join(" · ");

  const system =
    `You are a sales-intelligence analyst producing one section of a company profile. ` +
    `Output ONLY a valid JSON object matching exactly this schema (no markdown, no commentary):\n${schema}\n` +
    `Be specific to "${company}"${ctx ? ` (${ctx})` : ""}. Keep each string concise (under ~2 lines). Return valid JSON.`;

  const user =
    `Company: ${company}\n${ctx ? ctx + "\n" : ""}\n` +
    grounding +
    `SECTION (${blockType}) REQUIREMENT: ${requirement}\n\n` +
    `Return the JSON object for the ${blockType} block now.`;

  const body = {
    model: FORMAT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: false,
    max_completion_tokens: 1200, // small blocks; stays well under free-tier TPM
    temperature: 0.6,
    response_format: { type: "json_object" }, // guarantees valid JSON
  };

  const resp = await fetchWithRetry(body, key);
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    const err = new Error(`Generation failed (${resp.status}): ${detail.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Model returned no content.");
  JSON.parse(content); // json_object guarantees validity; verify to be safe
  return content;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const {
    groqKey, company, industry, region,
    blockType, requirement, stepNumber, stepTitle, isLast, searchBrief,
  } = req.body || {};

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // ── BYOK key check ──
  const key = (groqKey || "").trim();
  if (!looksLikeGroqKey(key)) {
    res.write(`${ERROR_SENTINEL}No valid Groq API key was provided. Add your free Groq key in your account settings, then try again.`);
    res.end();
    return;
  }

  // ── Input validation ──
  if (typeof company !== "string" || !company.trim() || company.length > 200) {
    res.write(`${ERROR_SENTINEL}Invalid company name.`); res.end(); return;
  }
  if (!BLOCK_SCHEMAS[blockType]) {
    res.write(`${ERROR_SENTINEL}Invalid block type.`); res.end(); return;
  }
  if (typeof requirement !== "string" || requirement.length > 2000) {
    res.write(`${ERROR_SENTINEL}Invalid section requirement.`); res.end(); return;
  }

  // Will this request trigger a NEW Brave search? Only when no brief was passed
  // (i.e. section 1 of a company) AND Brave is configured. Sections 2..11 and
  // resumes-with-brief don't search, so they never count against the limit.
  const willSearch = !(typeof searchBrief === "string" && searchBrief.trim()) && isBraveConfigured();

  // ── DAILY LIMIT (server-side, only for requests that will search) ──
  let limitUserId = null;
  if (willSearch && isLimitConfigured()) {
    const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
    limitUserId = await getUserId(token);
    // If we can't identify the user, we can't meter them. Require auth to
    // search (this matches the app gating searches behind sign-in).
    if (!limitUserId) {
      res.write(`${ERROR_SENTINEL}Please sign in to run a new company search.`);
      res.end();
      return;
    }
    const { allowed, used, limit } = await checkLimit(limitUserId);
    if (!allowed) {
      res.write(`${ERROR_SENTINEL}You've reached your daily limit of ${limit} company searches (used ${used}). It resets at midnight UTC. You can still re-open and continue saved reports from your history without using a search.`);
      res.end();
      return;
    }
  }

  try {
    // ── STAGE 1: get grounding context. Reuse the cached brief if the client
    //    sent one (sections 2..11); otherwise fetch once from Brave. ──
    let brief = (typeof searchBrief === "string" && searchBrief.trim()) ? searchBrief.trim() : null;
    let briefIsNew = false;
    if (!brief && isBraveConfigured()) {
      res.write(SEARCH_SENTINEL); // UI shows "Searching the web…"
      try {
        brief = await braveCompanyBrief({ company, industry, region });
        if (brief) briefIsNew = true;
      } catch {
        brief = null; // search failed → degrade to model-knowledge generation
      }
    }

    // Commit one unit ONLY when a fresh Brave search actually succeeded.
    // (Failed/empty searches don't consume the user's daily quota.)
    if (briefIsNew && limitUserId) {
      try { await commitUsage(limitUserId); } catch { /* non-fatal */ }
    }

    // ── STAGE 2: format the block (uses brief if present, else model knowledge). ──
    const json = await runFormat(
      { company, industry, region, blockType, requirement, brief },
      key
    );

    const status = isLast ? "DONE" : "CONTINUE";
    const block =
      `STEP_NUMBER: ${stepNumber}\n` +
      `STEP_TITLE: ${stepTitle}\n` +
      `THOUGHT: ${stepTitle} for ${company}.\n` +
      `BLOCK_TYPE: ${blockType}\n` +
      `BLOCK_DATA:\n${json}\n` +
      `STATUS: ${status}\n`;
    res.write(block);

    // Hand a freshly-fetched brief back so sections 2..11 reuse it (Brave is
    // then never called again for this company).
    if (briefIsNew && brief) {
      res.write(`${BRIEF_SENTINEL}${brief}`);
    }

    res.end();
  } catch (e) {
    const msg = String(e?.message || e);
    const status = e?.status;
    if (status === 401 || /401/.test(msg)) {
      res.write(`${ERROR_SENTINEL}Groq rejected your API key (401). Check it in account settings or make a new one at console.groq.com/keys.`);
    } else if (status === 429 || /429/.test(msg)) {
      res.write(`${ERROR_SENTINEL}Your Groq key hit its rate limit. Wait ~30-60s and retry this section.`);
    } else if (status === 413 || /413|too.large|request_too_large/i.test(msg)) {
      res.write(`${ERROR_SENTINEL}That section's request was too large for the free tier. Wait a moment and retry this section.`);
    } else {
      res.write(`${ERROR_SENTINEL}${msg}`);
    }
    res.end();
  }
}
