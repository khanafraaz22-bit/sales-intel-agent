// Grok (xAI) backend — drop-in alternative to api/agent.js for testing.
// Uses xAI's Responses API (/v1/responses) with the web_search tool.
// Streams plain text back in the SAME format as the Anthropic backend, so the
// frontend parser needs zero changes. Switch which backend the UI calls in
// src/lib/useAgent.js (AGENT_ENDPOINT).
//
// Env var required: XAI_API_KEY  (set in .env.local locally, or Vercel settings)

const XAI_URL = "https://api.x.ai/v1/responses";

// Sentinels the frontend parser understands (must match streamParser.js).
const SEARCH_SENTINEL = "\u0000SEARCH\u0000";
const ERROR_SENTINEL = "\u0000ERROR\u0000";

// Translate the Anthropic-style messages array into the Responses API `input`.
// Both use { role, content } with string content, so this is a light pass —
// system is sent separately as `instructions`.
function toResponsesInput(messages) {
  return messages.map((m) => ({
    role: m.role, // "user" | "assistant"
    content: m.content, // string
  }));
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

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  let upstream;
  try {
    upstream = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4.3",
        instructions: system, // system prompt
        input: toResponsesInput(messages),
        stream: true,
        max_output_tokens: 4096,
        tools: [{ type: "web_search" }],
      }),
    });
  } catch (e) {
    res.write(`${ERROR_SENTINEL}Network error reaching xAI: ${e.message}`);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    res.write(`${ERROR_SENTINEL}xAI returned ${upstream.status}: ${detail.slice(0, 500)}`);
    res.end();
    return;
  }

  // Parse the SSE stream from xAI. Events look like:
  //   event: response.output_text.delta
  //   data: {"delta":"some text", ...}
  // We forward text deltas, and emit a SEARCH sentinel when a web_search call
  // begins (event types containing "web_search" / "tool" with a search action).
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by double newlines.
      const frames = buffer.split("\n\n");
      buffer = frames.pop(); // keep the last partial frame

      for (const frame of frames) {
        const lines = frame.split("\n");
        let eventType = null;
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }
        if (!dataLine || dataLine === "[DONE]") continue;

        let payload;
        try {
          payload = JSON.parse(dataLine);
        } catch {
          continue;
        }

        const type = eventType || payload.type || "";

        // Surface search activity.
        if (type.includes("web_search") || type.includes("tool_call")) {
          res.write(SEARCH_SENTINEL);
          continue;
        }

        // Text deltas.
        if (type.endsWith("output_text.delta") && typeof payload.delta === "string") {
          res.write(payload.delta);
        } else if (type.endsWith("output_text.done") && typeof payload.text === "string") {
          // Some servers send a final consolidated text; ignore to avoid dupes.
        }
      }
    }
    res.end();
  } catch (e) {
    res.write(`${ERROR_SENTINEL}Stream error: ${e.message}`);
    res.end();
  }
}
