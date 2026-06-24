import { useState, useRef, useCallback } from "react";
import { parseStep } from "./streamParser.js";

// ── LEAN SYSTEM PROMPT ──────────────────────────────────────────
// The full MASTER_PROMPT contains its own 11-step "Continue" protocol, which
// fights the code-enforced per-step instructions and causes weaker models to
// loop. So we use a SHORT system prompt that only defines the output format +
// block schemas. The per-turn user message (built from STEP_SPECS) is the sole
// authority on which step to emit.
const SYSTEM_PROMPT = `You are a sales-intelligence analyst. You output ONE structured block per turn, in exactly this format and nothing else:

STEP_NUMBER: <number>
STEP_TITLE: <title>
THOUGHT: <1 short line on what this step covers>
BLOCK_TYPE: <one of: HERO, METRICS, CARD_GRID, TABLE, PAIN_POINTS, INSIGHTS, SOLUTIONS, PERSONAS, ROADMAP>
BLOCK_DATA:
<valid JSON only — no markdown, no code fences>
STATUS: <CONTINUE or DONE>

Each turn the user tells you EXACTLY which step number and block type to produce. Obey it precisely. Never repeat a previous step. Never output anything outside this format.

JSON schema per BLOCK_TYPE:
HERO: {"company_name","industry","region","growth_stage","key_insight","sales_angle","key_locations":["City, Country",...]}
METRICS: {"items":[{"label","value","signal":"positive|neutral|negative"}]}
CARD_GRID: {"cards":[{"title","bullets":["..."]}]}
TABLE: {"columns":["..."],"rows":[{"cells":["..."]}]}
PAIN_POINTS: {"points":[{"title","description","severity":"high|medium|low"}]}
INSIGHTS: {"insights":["..."]}
SOLUTIONS: {"solutions":[{"name","problem_solved","impact"}]}
PERSONAS: {"personas":[{"role","focus","motivation","objection"}]}
ROADMAP: {"phases":[{"phase","actions":["..."]}]}

Be specific to the company. Keep every bullet under 2 lines.`;
// ────────────────────────────────────────────────────────────────

// ── BACKEND SWITCH ──────────────────────────────────────────────
// Point the app at whichever backend you want to test. All speak the same
// plain-text streaming format, so nothing else in the app changes.
//   "/api/agent-groq"    → Groq (groq/compound), needs GROQ_API_KEY  (free + search, WORKS NOW)
//   "/api/agent"         → Anthropic (Claude), needs ANTHROPIC_API_KEY (final)
//   "/api/agent-gemini"  → Google Gemini, needs GEMINI_API_KEY (currently issues broken AQ. keys)
//   "/api/agent-grok"    → xAI Grok, needs XAI_API_KEY
const AGENT_ENDPOINT = "/api/agent-groq";
// ────────────────────────────────────────────────────────────────

// ── INTER-STEP DELAY ────────────────────────────────────────────
// Pause between auto-advanced steps so the provider's per-minute token bucket
// refills (prevents free-tier rate-limit 429s from piling up mid-run).
// 15s comfortably clears Groq's free tier for the 11-step flow. Lower it for
// speed once you move to a paid/Anthropic backend (e.g. 300).
const STEP_DELAY_MS = 15000;
// ────────────────────────────────────────────────────────────────

// ── EXPLICIT STEP SEQUENCE (code-enforced) ──────────────────────
// Weaker/faster models lose track of which step they're on and repeat the same
// block. So instead of a vague "continue", we tell the model EXACTLY which step,
// block type, and title to emit each turn. The server-side order is the source
// of truth, not the model's memory.
const STEP_SPECS = [
  { n: 1, type: "HERO", title: "Company Snapshot",
    inst: "Establish identity, growth stage, and the sharpest sales angle. Include key_locations: an array of 4-8 major cities where this company actually operates (HQ, major offices, key markets), each as \"City, Country\"." },
  { n: 2, type: "METRICS", title: "Signals",
    inst: "Revenue range, headcount, growth rate, digital maturity, market complexity." },
  { n: 3, type: "CARD_GRID", title: "Business Model Analysis",
    inst: "Exactly 4 cards: Revenue Streams, Customer Segments, Value Proposition, Competitive Moat." },
  { n: 4, type: "CARD_GRID", title: "Operations & Distribution",
    inst: "Exactly 4 cards: Supply Chain, Delivery Model, Key Geographies, Operational Risks." },
  { n: 5, type: "CARD_GRID", title: "Technology Stack",
    inst: "Exactly 4 cards: Current Platforms, Known Integrations, Tech Gaps, Maturity Level." },
  { n: 6, type: "PAIN_POINTS", title: "Pain Point Analysis",
    inst: "4-5 specific pains tied to their business model. Severity reflects real impact." },
  { n: 7, type: "TABLE", title: "Opportunity Map",
    inst: "Columns: Opportunity, Pain It Solves, Decision Maker, Priority. 5-6 rows." },
  { n: 8, type: "INSIGHTS", title: "AI Analyst Insights",
    inst: "6-8 sharp, non-obvious, company-specific observations for a live call." },
  { n: 9, type: "SOLUTIONS", title: "Recommended Solution Stack",
    inst: "4-5 solutions mapped to the pains from Step 6. Name problem solved + business impact." },
  { n: 10, type: "PERSONAS", title: "Buyer Personas",
    inst: "3-4 personas. Each includes a real objection they will raise." },
  { n: 11, type: "ROADMAP", title: "Sales Strategy Roadmap",
    inst: "3 phases (Outreach, Discovery, Close), 3-4 tailored actions each. Set STATUS: DONE." },
];

function stepInstruction(spec) {
  return `You are now on STEP ${spec.n} of 11. Output ONLY this one step, then stop.
STEP_NUMBER: ${spec.n}
STEP_TITLE: ${spec.title}
BLOCK_TYPE: ${spec.type}
Requirement: ${spec.inst}
Do NOT repeat any previous step. Do NOT skip ahead. Emit exactly one block of type ${spec.type} with valid JSON BLOCK_DATA, then STATUS: ${spec.n === 11 ? "DONE" : "CONTINUE"}.`;
}
// ────────────────────────────────────────────────────────────────

// State machine: idle -> running -> waiting -> running ... -> done
export function useAgent() {
  const [blocks, setBlocks] = useState([]); // completed step snapshots
  const [current, setCurrent] = useState(null); // the step currently streaming
  const [phase, setPhase] = useState("idle"); // idle | running | waiting | done | error
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0); // seconds left before next step

  const historyRef = useRef([]); // full message history sent to the API
  const autoRef = useRef(true); // auto-advance vs manual
  const stepRef = useRef(0); // which step index we're on (0-based into STEP_SPECS)
  const currentInstructionRef = useRef(null); // explicit instruction for the current step
  const parseRetryRef = useRef(0); // retries for a step whose block failed to parse

  // Run a single step: send history, stream the response, parse live.
  const runStep = useCallback(async () => {
    setPhase("running");
    setError(null);
    setCurrent({ searching: false });

    // Stall watchdog: abort if NO data arrives for this many ms. It resets on
    // every chunk, so a slow-but-progressing stream is fine; only true silence
    // (a hung search or dead connection) trips it.
    const STALL_MS = 90000; // 90s of total silence
    const controller = new AbortController();
    let stallTimer = null;
    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), STALL_MS);
    };

    let res;
    try {
      armStall();
      // Send ONLY the company context + the current step instruction — not the
      // accumulated prior blocks. This stops weaker models from pattern-matching
      // to (and repeating) earlier steps, and slashes token usage so we don't
      // hit rate limits. Each step is self-contained by design.
      const requestMessages = [
        historyRef.current[0], // the company-context + step-1 message
      ];
      if (currentInstructionRef.current) {
        requestMessages.push({
          role: "user",
          content: currentInstructionRef.current,
        });
      }
      res = await fetch(AGENT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: requestMessages,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (stallTimer) clearTimeout(stallTimer);
      setError(
        e.name === "AbortError"
          ? "The model went silent for 90s (likely a slow web search). Click Continue to retry this step."
          : "Network error reaching the backend. Is `vercel dev` running?"
      );
      setPhase("waiting"); // allow retry
      return;
    }

    if (!res.ok || !res.body) {
      if (stallTimer) clearTimeout(stallTimer);
      setError(`Server returned ${res.status}`);
      setPhase("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let parsed = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armStall(); // got data — reset the watchdog
        buffer += decoder.decode(value, { stream: true });
        parsed = parseStep(buffer);
        setCurrent(parsed);
        if (parsed.error) {
          if (stallTimer) clearTimeout(stallTimer);
          setError(parsed.error);
          setPhase("error");
          return;
        }
      }
    } catch (e) {
      if (stallTimer) clearTimeout(stallTimer);
      setError(
        "The stream stalled (likely a slow web search on this step). Click Continue to retry this step."
      );
      setPhase("waiting");
      return;
    }
    if (stallTimer) clearTimeout(stallTimer);

    // (We intentionally do NOT append the assistant block to history — each step
    // is sent self-contained: company context + the current step instruction.)

    if (parsed && parsed.blockData) {
      setBlocks((b) => [...b, parsed]);
      parseRetryRef.current = 0; // success — reset retry counter
    } else {
      // Block didn't parse (malformed JSON, truncated, etc). Retry this SAME
      // step once before giving up, rather than silently leaving a gap.
      if (parseRetryRef.current < 1) {
        parseRetryRef.current += 1;
        setCurrent(null);
        if (autoRef.current) {
          setPhase("running");
          setTimeout(() => runStep(), 1500); // brief pause, same step
        } else {
          setPhase("waiting");
        }
        return;
      }
      // Already retried once — record a placeholder so the gap is visible, then
      // move on so the run can still finish.
      parseRetryRef.current = 0;
      const spec = STEP_SPECS[stepRef.current];
      setBlocks((b) => [
        ...b,
        {
          blockType: spec?.type,
          stepNumber: spec?.n,
          stepTitle: spec?.title,
          thought: "This section didn't generate cleanly — you can Reset and retry.",
          blockData: null,
          parseFailed: true,
        },
      ]);
    }
    setCurrent(null);

    const isDone = parsed?.status === "DONE";
    if (isDone) {
      setPhase("done");
      return;
    }

    // Advance to the next step and set its explicit instruction (used as the
    // sole per-turn user message — we don't accumulate prior blocks).
    stepRef.current += 1;
    const nextSpec = STEP_SPECS[stepRef.current];
    if (!nextSpec) {
      // Safety: ran out of specs — treat as done.
      setPhase("done");
      return;
    }
    currentInstructionRef.current = stepInstruction(nextSpec);

    if (autoRef.current) {
      // Auto-advance after a cooldown so the rate-limit bucket refills.
      setPhase("running");
      const totalSec = Math.ceil(STEP_DELAY_MS / 1000);
      setCooldown(totalSec);
      let left = totalSec;
      const tick = setInterval(() => {
        left -= 1;
        setCooldown(left);
        if (left <= 0) {
          clearInterval(tick);
          setCooldown(0);
          runStep();
        }
      }, 1000);
    } else {
      setPhase("waiting");
    }
  }, []);

  // Kick off a fresh analysis.
  const start = useCallback(
    ({ company, industry, region, autoAdvance }) => {
      autoRef.current = autoAdvance;
      stepRef.current = 0;
      currentInstructionRef.current = null;
      parseRetryRef.current = 0;
      setBlocks([]);
      setCurrent(null);
      setError(null);
      historyRef.current = [
        {
          role: "user",
          content: `Analyze this company across an 11-step sales-intelligence sequence.
Company: ${company}
Industry: ${industry}
Region: ${region}

${stepInstruction(STEP_SPECS[0])}`,
        },
      ];
      runStep();
    },
    [runStep]
  );

  const reset = useCallback(() => {
    historyRef.current = [];
    stepRef.current = 0;
    currentInstructionRef.current = null;
    parseRetryRef.current = 0;
    setBlocks([]);
    setCurrent(null);
    setError(null);
    setCooldown(0);
    setPhase("idle");
  }, []);

  // Restore a previously-saved report directly into the "done" state,
  // bypassing the AI entirely (no Groq call).
  const restore = useCallback((savedBlocks) => {
    historyRef.current = [];
    stepRef.current = STEP_SPECS.length;
    currentInstructionRef.current = null;
    parseRetryRef.current = 0;
    setBlocks(Array.isArray(savedBlocks) ? savedBlocks : []);
    setCurrent(null);
    setError(null);
    setCooldown(0);
    setPhase("done");
  }, []);

  return { blocks, current, phase, error, cooldown, start, runStep, reset, restore };
}