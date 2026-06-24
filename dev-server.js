// Local dev API server — runs the Vercel functions in /api WITHOUT needing
// `vercel dev` (no Vercel login, no framework detection, no $PORT issues).
//
// The functions in /api use the (req, res) signature with res.write/res.end,
// which Express supports natively, so they run here unmodified.
//
// Usage:  npm run api    (this server on :3000)
//         npm run dev    (Vite on :5173, proxies /api here)
//
// Reads keys from .env.local (or .env) in the project root.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load env from .env.local (preferred) or .env ──
function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(__dirname, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, ""); // strip quotes
      if (val && !process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

const app = express();
app.use(express.json({ limit: "5mb" }));

// Map each /api/*.js file to a route, loading the default export as the handler.
const apiDir = path.join(__dirname, "api");
const files = fs.readdirSync(apiDir).filter((f) => f.endsWith(".js"));

for (const file of files) {
  const route = "/api/" + file.replace(/\.js$/, "");
  const modUrl = pathToFileURL(path.join(apiDir, file)).href;
  app.all(route, async (req, res) => {
    try {
      const mod = await import(modUrl);
      const handler = mod.default;
      if (typeof handler !== "function") {
        res.status(500).json({ error: `${file} has no default export` });
        return;
      }
      await handler(req, res);
    } catch (err) {
      console.error(`Error in ${file}:`, err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
      else res.end();
    }
  });
  console.log(`  ${route}  →  api/${file}`);
}

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nLocal API server running on http://localhost:${PORT}`);
  const groq = process.env.GROQ_API_KEY;
  console.log(
    groq
      ? `GROQ_API_KEY loaded (prefix ${groq.slice(0, 4)}, length ${groq.length})`
      : `WARNING: GROQ_API_KEY not found in .env.local or .env`
  );
  console.log("");
});
