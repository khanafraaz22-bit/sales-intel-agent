import Anthropic from "@anthropic-ai/sdk";

// Vercel serverless function. Runs on the server only — the API key never
// reaches the browser. The frontend POSTs { system, messages } here.

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

  // Stream plain text back to the browser as it arrives.
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
    });

    stream.on("text", (textDelta) => {
      res.write(textDelta);
    });

    // Surface search activity to the UI as an inline sentinel the parser ignores
    // for block data but can use to show a "searching" indicator.
    stream.on("streamEvent", (event) => {
      if (
        event.type === "content_block_start" &&
        event.content_block?.type === "server_tool_use" &&
        event.content_block?.name === "web_search"
      ) {
        res.write("\u0000SEARCH\u0000");
      }
    });

    await stream.finalMessage();
    res.end();
  } catch (err) {
    console.error("Anthropic API error:", err);
    // If nothing was streamed yet, send a JSON-ish error the parser can show.
    res.write(`\u0000ERROR\u0000${err?.message || "Unknown error"}`);
    res.end();
  }
}
