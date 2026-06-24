// Gemini (Google) backend — free tier with Google Search grounding.
// Uses the Generative Language API streamGenerateContent endpoint with the
// google_search tool. Streams plain text back in the SAME format as the other
// backends, so the frontend parser needs zero changes.
//
// Env var required: GEMINI_API_KEY  (set in .env.local locally, or Vercel settings)

const MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

// Sentinels the frontend parser understands (must match streamParser.js).
const SEARCH_SENTINEL = "\u0000SEARCH\u0000";
const ERROR_SENTINEL = "\u0000ERROR\u0000";

// Translate the shared { role: "user"|"assistant", content } history into
// Gemini's `contents` format: role "model" instead of "assistant", text under parts[].
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
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
    upstream = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: toGeminiContents(messages),
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
      }),
    });
  } catch (e) {
    res.write(`${ERROR_SENTINEL}Network error reaching Gemini: ${e.message}`);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    res.write(`${ERROR_SENTINEL}Gemini returned ${upstream.status}: ${detail.slice(0, 500)}`);
    res.end();
    return;
  }

  // Gemini SSE frames look like:
  //   data: {"candidates":[{"content":{"parts":[{"text":"..."}]},...,
  //          "groundingMetadata":{...}}],...}
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
        if (!json || json === "[DONE]") continue;

        let payload;
        try {
          payload = JSON.parse(json);
        } catch {
          continue;
        }

        const cand = payload.candidates?.[0];
        if (!cand) continue;

        // Announce search activity once when grounding metadata first appears.
        if (!searchAnnounced && cand.groundingMetadata) {
          res.write(SEARCH_SENTINEL);
          searchAnnounced = true;
        }

        const parts = cand.content?.parts || [];
        for (const part of parts) {
          if (typeof part.text === "string") res.write(part.text);
        }
      }
    }
    res.end();
  } catch (e) {
    res.write(`${ERROR_SENTINEL}Stream error: ${e.message}`);
    res.end();
  }
}
