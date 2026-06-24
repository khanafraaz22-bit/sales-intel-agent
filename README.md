# Sales Intelligence Agent

A live, step-by-step company analysis app. React frontend + a Vercel serverless
function that calls Claude (Sonnet 4.6) with web search and streams structured
blocks back to the UI one step at a time (11 steps total).

## Architecture

```
Browser (React)  ->  /api/agent (Vercel serverless)  ->  Anthropic API
   no API key          holds ANTHROPIC_API_KEY            web_search + streaming
```

The API key NEVER reaches the browser. The browser only talks to `/api/agent`.
The frontend holds the full message history and re-sends it each step so the
agent remembers prior steps (the API is stateless).

## Three backends — switch with one line

There are three serverless functions in `/api`, all streaming the SAME
plain-text format so the frontend is identical no matter which you use:

- `api/agent-gemini.js` — Google Gemini (`gemini-2.5-flash`) with Google Search
  grounding. Needs `GEMINI_API_KEY`. **Free tier + web search — use this for testing.**
- `api/agent.js` — Anthropic (`claude-sonnet-4-6`) with web search.
  Needs `ANTHROPIC_API_KEY`. **The final/production backend.**
- `api/agent-grok.js` — xAI Grok with web search. Needs `XAI_API_KEY`.

Pick which one the app calls with ONE line in `src/lib/useAgent.js`:

```js
const AGENT_ENDPOINT = "/api/agent-gemini";  // testing with Gemini (free + search)
// const AGENT_ENDPOINT = "/api/agent";      // final, with Claude
// const AGENT_ENDPOINT = "/api/agent-grok"; // xAI Grok
```

### Where the keys go

`.env.local` lives in the project ROOT (next to `package.json`). It is
gitignored. Fill in whichever key you're using:

```
GEMINI_API_KEY=...        # free, from https://aistudio.google.com/apikey
ANTHROPIC_API_KEY=sk-ant-...
XAI_API_KEY=xai-...
```

On Vercel, set the same names under Project Settings → Environment Variables.

## Local development (Windows / Mac / Linux)

You need TWO terminals: one for the API backend (`vercel dev`), one for the
frontend (`vite`). They run side by side.

### First time only
1. Install dependencies (creates the `node_modules` folder — REQUIRED, this is
   what provides `vite`):
   ```
   npm install
   ```
2. Install the Vercel CLI globally if you don't have it:
   ```
   npm i -g vercel
   ```
3. Put your key in `.env.local` (project root):
   ```
   GROQ_API_KEY=gsk_...
   ```

### Every run — two terminals

**Terminal 1 — API backend (serves /api on port 3000):**
   ```
   vercel dev --listen 3000
   ```
   The included `vercel.json` sets `devCommand` to a no-op and `framework` to
   null, so `vercel dev` ONLY serves the /api functions — it will NOT try to run
   Vite. (That's what caused the "'vite' is not recognized" / "$PORT" error.)
   First run may ask you to log in and set up a project; accept the defaults.

**Terminal 2 — frontend (Vite, port 5173):**
   ```
   npm run dev
   ```
   Open the URL it prints, usually http://localhost:5173

Vite proxies `/api` calls to port 3000 (see `vite.config.js`), so the frontend
and backend talk to each other automatically.

### Common errors
- **"'vite' is not recognized"** → you skipped `npm install`. Run it.
- **vercel dev tries to run `vite --port $PORT` and fails** → you have an old
  `vercel.json`; the updated one (devCommand "echo api-only", framework null)
  fixes this.
- **Generate button fails / network error** → the `vercel dev` terminal isn't
  running. Both terminals must be up.

## Deploy to Vercel

1. Push this folder to a Git repo.
2. Import it in Vercel.
3. In Project Settings -> Environment Variables, add:
   ```
   ANTHROPIC_API_KEY = sk-ant-...
   ```
4. Deploy. Vercel auto-detects Vite for the frontend and serves `api/agent.js`
   as a serverless function.

## How a step flows

1. Form submits company/industry/region -> kickoff message.
2. `useAgent` POSTs `{ system, messages }` to `/api/agent`.
3. The serverless fn streams Claude's tokens back as plain text.
4. `streamParser.js` extracts STEP_NUMBER / STEP_TITLE / THOUGHT / BLOCK_TYPE /
   BLOCK_DATA (JSON) / STATUS from the buffer as it grows.
5. `StepFeed` renders the matching block component.
6. On `STATUS: CONTINUE`, history gets the assistant turn + a "Continue" user
   turn, and the next step fires (auto or on click).
7. On `STATUS: DONE`, it stops.

## Editing the agent

The behaviour lives entirely in `src/prompt.js` (the master prompt). Block
visuals live in `src/components/blocks/`. To add a new block type: add its
schema to the prompt, create a component, register it in `StepFeed.jsx`.

## Notes

- Web search is capped at 5 uses per step (`max_uses` in `api/agent.js`).
- `max_tokens` is 4096 per step; raise it in `api/agent.js` if blocks get cut off.
- No `localStorage` is used. State is in React memory and resets on reload.
