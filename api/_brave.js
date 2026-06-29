// Brave Search — server-side web grounding for company research.
//
// Uses Brave's LLM Context endpoint (/res/v1/llm/context), which returns
// compacted, model-ready web context (better for feeding an LLM than raw
// snippets). Billed under Brave's Search plan: one request per call, same
// query budget as web search. We call it ONCE per company (the result is
// reused across all 11 sections), so ~1,000 free monthly credits ≈ 1,000
// companies.
//
// The key is SERVER-SIDE ONLY (process.env.BRAVE_API_KEY) — never sent to the
// browser. If the key is absent, search is skipped gracefully and the caller
// falls back to model-knowledge generation.

const BRAVE_LLM_CONTEXT_URL = "https://api.search.brave.com/res/v1/llm/context";
const BRAVE_WEB_URL = "https://api.search.brave.com/res/v1/web/search";

// Cap how much context we pass downstream. Brave can return a lot; Groq's
// free-tier TPM (~6K) is the real ceiling, so we trim to stay well clear of
// the 413 that bit us with compound. ~6000 chars ≈ ~1500 tokens of grounding.
const MAX_CONTEXT_CHARS = 6000;

export function isBraveConfigured() {
  return Boolean((process.env.BRAVE_API_KEY || "").trim());
}

// Build a focused research query for a company.
function companyQuery(company, industry, region) {
  const bits = [company];
  if (industry && industry !== "Unknown") bits.push(industry);
  if (region && region !== "Global") bits.push(region);
  return `${bits.join(" ")} company overview headquarters revenue business model technology customers`;
}

// Fetch grounding context for a company. Returns a plain-text brief, or null if
// Brave isn't configured or the call fails (caller then degrades gracefully).
export async function braveCompanyBrief({ company, industry, region }) {
  const key = (process.env.BRAVE_API_KEY || "").trim();
  if (!key) return null;

  const q = companyQuery(company, industry, region);

  // Try the LLM Context endpoint first (model-ready grounding).
  try {
    const url = new URL(BRAVE_LLM_CONTEXT_URL);
    url.searchParams.set("q", q);
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = extractContextText(data);
      if (text) return trim(text);
    }
    // If LLM Context isn't available on the plan, fall through to web search.
  } catch {
    /* fall through to web search */
  }

  // Fallback: classic Web Search → assemble snippets into a brief.
  try {
    const url = new URL(BRAVE_WEB_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("count", "8");
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const results = data?.web?.results || [];
    if (!results.length) return null;
    const brief = results
      .slice(0, 8)
      .map((r) => {
        const title = r.title || "";
        const desc = r.description || r.snippet || "";
        return `• ${title}: ${desc}`;
      })
      .join("\n");
    return trim(brief);
  } catch {
    return null;
  }
}

// The LLM Context response shape can vary; pull readable text out of it
// defensively rather than assuming one schema.
function extractContextText(data) {
  if (!data) return null;
  if (typeof data === "string") return data;
  // Common shapes: { context: "..." } or { results: [{ text }] } or chunks.
  if (typeof data.context === "string") return data.context;
  if (Array.isArray(data.results)) {
    const parts = data.results
      .map((r) => (typeof r === "string" ? r : r.text || r.content || r.description || ""))
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }
  if (Array.isArray(data.chunks)) {
    const parts = data.chunks.map((c) => (typeof c === "string" ? c : c.text || "")).filter(Boolean);
    if (parts.length) return parts.join("\n");
  }
  return null;
}

function trim(text) {
  const t = String(text).replace(/\s+\n/g, "\n").trim();
  return t.length > MAX_CONTEXT_CHARS ? t.slice(0, MAX_CONTEXT_CHARS) + "…" : t;
}

// ── LinkedIn decision-maker discovery ───────────────────────────
// Searches Brave for PUBLIC LinkedIn profiles of a company's top
// decision-makers. Returns real, linkable profiles only — never fabricated.
// If nothing is found, returns an empty array (caller shows "no public
// profiles found" honestly). One Brave web-search call per company.

const SENIOR_TITLE_RX = /\b(CEO|chief executive|founder|co-?founder|president|CFO|chief financial|CTO|chief technology|COO|chief operating|CIO|chief information|CMO|chief marketing|CDO|chief digital|managing director|owner|head of|VP|vice president|director)\b/i;

// Parse a Brave result for a linkedin.com/in/ profile into {name,title,url}.
// Brave titles look like "Jane Doe - CEO at Acme | LinkedIn" or
// "Jane Doe - Acme - CEO - LinkedIn". We extract name (before first dash) and
// title (the part containing a seniority keyword).
function parseLinkedInResult(r) {
  const url = r.url || r.link || "";
  if (!/linkedin\.com\/in\//i.test(url)) return null;

  let raw = (r.title || "").replace(/\s*[|–-]\s*LinkedIn\s*$/i, "").trim();
  if (!raw) return null;

  // Split on dashes/pipes into segments.
  const segs = raw.split(/\s+[-–|]\s+/).map((s) => s.trim()).filter(Boolean);
  const name = segs[0] || raw;

  // Title = first segment (after the name) that contains a seniority keyword,
  // else the second segment, else pull from the description.
  let title = segs.slice(1).find((s) => SENIOR_TITLE_RX.test(s)) || segs[1] || "";
  if (!title && r.description) {
    const m = (r.description || "").match(new RegExp(`(${SENIOR_TITLE_RX.source})[^.,;|]*`, "i"));
    if (m) title = m[0].trim();
  }

  // Basic sanity: a real name has 2+ words, no weird length.
  if (!name || name.length > 60 || name.split(/\s+/).length < 2) return null;

  return { name: name.trim(), title: (title || "").trim(), url: url.split("?")[0] };
}

export async function braveLinkedInProfiles({ company }) {
  const key = (process.env.BRAVE_API_KEY || "").trim();
  if (!key || !company) return [];

  const q = `${company} (CEO OR Founder OR CFO OR CTO OR COO OR President OR "Managing Director") site:linkedin.com/in`;

  try {
    const url = new URL(BRAVE_WEB_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("count", "12");
    const resp = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": key },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results = data?.web?.results || [];

    const seen = new Set();
    const profiles = [];
    for (const r of results) {
      const p = parseLinkedInResult(r);
      if (!p) continue;
      const dedupKey = p.url.toLowerCase();
      if (seen.has(dedupKey)) continue;
      // Keep only profiles that look like genuine decision-makers, OR keep
      // anyway if we matched a /in/ profile for this company search.
      seen.add(dedupKey);
      profiles.push(p);
      if (profiles.length >= 6) break;
    }
    return profiles;
  } catch {
    return [];
  }
}

