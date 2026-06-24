// Groq backend — free tier with built-in web search via the groq/compound system.
// Groq is OpenAI-compatible: standard /chat/completions endpoint, messages format,
// SSE streaming with choices[].delta.content. The compound model runs web search
// server-side automatically (no tools array needed). Streams plain text back in
// the SAME format as the other backends, so the frontend parser needs no changes.
//
// Env var required: GROQ_API_KEY  (set in .env.local locally, or Vercel settings)

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── MODEL CHOICE ────────────────────────────────────────────────
// With steps now enforced in code (the frontend tells the model exactly which
// step to emit), the bigger 70B model gives better-written, more coherent
// blocks. The inter-step delay + 429 retry handle its rate limits.
//
// "llama-3.3-70b-versatile"  → stronger reasoning, better blocks (default).
// "llama-3.1-8b-instant"     → faster/higher throughput but weaker quality.
// "groq/compound"            → built-in web search, but SLOW.
const MODEL = "llama-3.3-70b-versatile";
const USES_SEARCH = MODEL === "groq/compound";

// Auto-retry settings for rate limits (HTTP 429).
const MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 8000;
// ────────────────────────────────────────────────────────────────

// Sentinels the frontend parser understands (must match streamParser.js).
const SEARCH_SENTINEL = "\u0000SEARCH\u0000";
const ERROR_SENTINEL = "\u0000ERROR\u0000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch from Groq, retrying on 429 (rate limit). Reads the Retry-After header
// (seconds) when present, otherwise backs off a default. Returns the response
// once it's non-429, or the final 429 response after exhausting retries.
async function fetchWithRetry(body, key, onWait) {
  let attempt = 0;
  while (true) {
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (resp.status !== 429 || attempt >= MAX_RETRIES) return resp;

    // Rate limited — figure out how long to wait.
    const ra = resp.headers.get("retry-after");
    let waitMs = ra ? Math.ceil(parseFloat(ra) * 1000) : DEFAULT_BACKOFF_MS;
    if (!Number.isFinite(waitMs) || waitMs <= 0) waitMs = DEFAULT_BACKOFF_MS;
    waitMs = Math.min(waitMs + 500, 60000); // small cushion, cap at 60s

    attempt++;
    if (onWait) onWait(waitMs, attempt);
    await sleep(waitMs);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { system, messages } = req.body || {};
  if (!system || !Array.isArray(messages)) {
    res.status(400).json({ error: "Missing system or messages" });
    return;
  }

  // ── Input validation / abuse guard ──
  // Cap payload sizes so a malicious client can't send huge prompts to burn tokens.
  if (typeof system !== "string" || system.length > 8000) {
    res.status(400).json({ error: "Invalid system prompt." });
    return;
  }
  if (messages.length > 6) {
    res.status(400).json({ error: "Too many messages in one request." });
    return;
  }
  for (const m of messages) {
    if (!m || typeof m.content !== "string" || m.content.length > 8000) {
      res.status(400).json({ error: "Invalid message content." });
      return;
    }
  }
  // ────────────────────────────────────

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // Groq/OpenAI format: system prompt is just the first message with role "system".
  const fullMessages = [{ role: "system", content: system }, ...messages];

  // ── DEBUG: confirm the key actually reached the function ──
  const key = process.env.GROQ_API_KEY;
  if (!key || key.trim() === "") {
    res.write(
      `${ERROR_SENTINEL}GROQ_API_KEY is EMPTY inside the function — vercel dev is not loading .env.local. ` +
        `Fix: copy .env.local to .env, then restart vercel dev.`
    );
    res.end();
    return;
  }
  // Reports prefix + length only (never the full key) so we can spot bad copies.
  console.log(
    `[agent-groq] key loaded: prefix=${key.slice(0, 4)} length=${key.length}`
  );
  // ──────────────────────────────────────────────────────────

  let upstream;
  try {
    upstream = await fetchWithRetry(
      {
        model: MODEL,
        messages: fullMessages,
        stream: true,
        max_completion_tokens: 4096,
        temperature: 0.7,
      },
      key,
      (waitMs) => {
        // Tell the UI we're waiting out a rate limit (parser shows "searching"
        // style indicator; harmless if ignored).
        res.write(SEARCH_SENTINEL);
        console.log(
          `[agent-groq] rate limited (429) — waiting ${Math.round(waitMs / 1000)}s then retrying`
        );
      }
    );
  } catch (e) {
    res.write(`${ERROR_SENTINEL}Network error reaching Groq: ${e.message}`);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    if (upstream.status === 429) {
      res.write(
        `${ERROR_SENTINEL}Groq free-tier rate limit hit and didn't clear after retries. ` +
          `Wait ~30-60s and click Continue, or switch to a smaller model in api/agent-groq.js.`
      );
    } else {
      res.write(`${ERROR_SENTINEL}Groq returned ${upstream.status}: ${detail.slice(0, 500)}`);
    }
    res.end();
    return;
  }

  // OpenAI-style SSE frames:
  //   data: {"choices":[{"delta":{"content":"text"}}]}
  //   data: [DONE]
  // Compound search activity surfaces in delta.executed_tools / reasoning; we
  // emit a SEARCH sentinel the first time we see a tool/search marker.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let searchAnnounced = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop(); // keep partial frame

      for (const frame of frames) {
        const dataLine = frame
          .split("\n")
          .find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json) continue;
        if (json === "[DONE]") continue;

        let payload;
        try {
          payload = JSON.parse(json);
        } catch {
          continue;
        }

        const delta = payload.choices?.[0]?.delta;
        if (!delta) continue;

        // Surface search activity once (compound exposes executed_tools / reasoning).
        if (!searchAnnounced && (delta.executed_tools || delta.reasoning)) {
          res.write(SEARCH_SENTINEL);
          searchAnnounced = true;
        }

        if (typeof delta.content === "string" && delta.content.length) {
          res.write(delta.content);
        }
      }
    }
    res.end();
  } catch (e) {
    res.write(`${ERROR_SENTINEL}Stream error: ${e.message}`);
    res.end();
  }
}
