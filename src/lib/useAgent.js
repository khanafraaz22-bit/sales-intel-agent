import { useState, useRef, useCallback } from "react";
import { parseStep } from "./streamParser.js";

// ── LEAN SYSTEM PROMPT ──────────────────────────────────────────
// Short system prompt that only defines the output format + block schemas.
// The per-turn user message (built from STEP_SPECS) is the sole authority on
// which step to emit.
const SYSTEM_PROMPT = `You are a sales-intelligence analyst. You output ONE structured block per turn, in exactly this format and nothing else:

STEP_NUMBER: <number>
STEP_TITLE: <title>
THOUGHT: <1 short line on what this step covers>
BLOCK_TYPE: <one of: HERO, METRICS, CARD_GRID, TABLE, PAIN_POINTS, INSIGHTS, SOLUTIONS, PERSONAS, ROADMAP>
BLOCK_DATA:
<valid JSON only — no markdown, no code fences>
STATUS: <CONTINUE or DONE>

Each turn the user tells you EXACTLY which step number and block type to produce. Obey it precisely. Never repeat a previous step. Never output anything outside this format.
When you have web search available, use it to ground every block in real, current facts about the specific company — especially smaller or private companies you may not know from memory. Prefer real figures, real locations, and real technologies over generic guesses.

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
//   "/api/agent-groq"    → Groq (groq/compound), BYOK + search  (current)
//   "/api/agent"         → Anthropic (Claude), needs ANTHROPIC_API_KEY (final)
const AGENT_ENDPOINT = "/api/agent-groq";
// ────────────────────────────────────────────────────────────────

// ── EXPLICIT STEP SEQUENCE (code-enforced) ──────────────────────
// We tell the model EXACTLY which step, block type, and title to emit each turn.
// The server-side order is the source of truth, not the model's memory.
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

export const TOTAL_STEPS = STEP_SPECS.length;

function stepInstruction(spec) {
  return `You are now on STEP ${spec.n} of 11. Output ONLY this one step, then stop.
STEP_NUMBER: ${spec.n}
STEP_TITLE: ${spec.title}
BLOCK_TYPE: ${spec.type}
Requirement: ${spec.inst}
Do NOT repeat any previous step. Do NOT skip ahead. Emit exactly one block of type ${spec.type} with valid JSON BLOCK_DATA, then STATUS: ${spec.n === 11 ? "DONE" : "CONTINUE"}.`;
}
// ────────────────────────────────────────────────────────────────

// State machine (now fully MANUAL):
//   idle -> running -> waiting(after each step) -> running -> ... -> done
// The user clicks "Generate next section" to advance; there is no auto-advance
// and no inter-step cooldown chain. With BYOK each user has their own quota.
export function useAgent({ getGroqKey, getToken } = {}) {
  const [blocks, setBlocks] = useState([]);     // completed step snapshots
  const [current, setCurrent] = useState(null); // the step currently streaming
  const [phase, setPhase] = useState("idle");   // idle | running | waiting | done | error
  const [error, setError] = useState(null);

  const companyMetaRef = useRef({ company: "", industry: "Unknown", region: "Global" });
  const briefRef = useRef(null);                 // section-1 research brief (reused 2..11)
  const stepRef = useRef(0);                     // 0-based index into STEP_SPECS
  const parseRetryRef = useRef(0);               // retries for a failed parse

  // doneCount derives from blocks; nextStepNumber is 1-based for display.
  const nextStepNumber = stepRef.current + 1;

  // Build the structured request body for the CURRENT step. The backend runs
  // the two-stage (search → format) pipeline; we pass the cached brief so it
  // only searches on section 1.
  const buildRequestBody = useCallback((groqKey) => {
    const spec = STEP_SPECS[stepRef.current];
    const meta = companyMetaRef.current;
    return {
      groqKey,
      company: meta.company,
      industry: meta.industry,
      region: meta.region,
      blockType: spec.type,
      requirement: spec.inst,
      stepNumber: spec.n,
      stepTitle: spec.title,
      isLast: spec.n === STEP_SPECS.length,
      searchBrief: briefRef.current || undefined, // present on 2..11
    };
  }, []);

  // Run exactly ONE step, then stop in "waiting" (or "done" on the last step).
  const runStep = useCallback(async () => {
    const spec = STEP_SPECS[stepRef.current];
    if (!spec) { setPhase("done"); return; }

    const groqKey = getGroqKey ? getGroqKey() : "";

    setPhase("running");
    setError(null);
    setCurrent({ searching: false });

    const STALL_MS = 90000; // 90s of total silence aborts
    const controller = new AbortController();
    let stallTimer = null;
    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), STALL_MS);
    };

    let res;
    try {
      armStall();
      const authToken = getToken ? getToken() : null;
      res = await fetch(AGENT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(buildRequestBody(groqKey)),
        signal: controller.signal,
      });
    } catch (e) {
      if (stallTimer) clearTimeout(stallTimer);
      setError(
        e.name === "AbortError"
          ? "The model went silent for 90s (likely a slow web search). Click Generate to retry this section."
          : "Network error reaching the backend. Is the API server running?"
      );
      setPhase("waiting");
      return;
    }

    if (!res.ok || !res.body) {
      if (stallTimer) clearTimeout(stallTimer);
      setError(`Server returned ${res.status}`);
      setPhase("waiting");
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
        armStall();
        buffer += decoder.decode(value, { stream: true });
        parsed = parseStep(buffer);
        setCurrent(parsed);
        if (parsed.error) {
          if (stallTimer) clearTimeout(stallTimer);
          setError(parsed.error);
          setPhase("waiting"); // recoverable — let them retry this section
          setCurrent(null);
          return;
        }
      }
    } catch (e) {
      if (stallTimer) clearTimeout(stallTimer);
      setError(
        "The stream stalled (likely a slow web search on this section). Click Generate to retry it."
      );
      setPhase("waiting");
      return;
    }
    if (stallTimer) clearTimeout(stallTimer);

    // Capture the section-1 research brief so sections 2..11 reuse it (the
    // backend then skips the search stage entirely).
    if (parsed && parsed.brief && !briefRef.current) {
      briefRef.current = parsed.brief;
    }

    if (parsed && parsed.blockData) {
      setBlocks((b) => [...b, parsed]);
      parseRetryRef.current = 0;
    } else {
      // Block didn't parse (truncated, empty, or malformed — often a transient
      // compound/rate-limit hiccup). Auto-retry the SAME section a couple of
      // times with a short backoff before surfacing it to the user. Random
      // failures usually clear on the next attempt.
      const MAX_AUTO_RETRIES = 2;
      if (parseRetryRef.current < MAX_AUTO_RETRIES) {
        parseRetryRef.current += 1;
        setCurrent(null);
        setError(null);
        setPhase("running");
        // Backoff grows a little each attempt so we don't hammer a rate limit.
        const backoff = 2500 * parseRetryRef.current;
        setTimeout(() => runStep(), backoff);
        return;
      }
      // Auto-retries exhausted — now ask the user to retry manually.
      parseRetryRef.current = 0;
      setCurrent(null);
      setError("That section didn't generate cleanly after a few tries. Click Generate to retry it.");
      setPhase("waiting");
      return;
    }
    setCurrent(null);

    const isLast = stepRef.current >= STEP_SPECS.length - 1;
    const isDone = parsed?.status === "DONE" || isLast;

    // Advance the pointer for the next manual click.
    stepRef.current += 1;

    if (isDone || stepRef.current >= STEP_SPECS.length) {
      setPhase("done");
    } else {
      // MANUAL: stop and wait for the user to click "Generate next section".
      setPhase("waiting");
    }
  }, [buildRequestBody, getGroqKey, getToken]);

  // Kick off a fresh analysis — generates ONLY section 1, then waits.
  const start = useCallback(
    ({ company, industry, region }) => {
      stepRef.current = 0;
      parseRetryRef.current = 0;
      briefRef.current = null; // fresh company → fresh search on section 1
      setBlocks([]);
      setCurrent(null);
      setError(null);
      companyMetaRef.current = {
        company,
        industry: industry || "Unknown",
        region: region || "Global",
      };
      runStep();
    },
    [runStep]
  );

  // Manually generate the next section (user-gated).
  const next = useCallback(() => {
    if (phase === "running") return;
    runStep();
  }, [phase, runStep]);

  // Finish early: mark the run done with whatever sections exist so far.
  // Guard: if NO section produced usable data (only failed placeholders), don't
  // drop the user onto an empty report — keep them on the generating screen with
  // an error so they can retry.
  const finishHere = useCallback(() => {
    setBlocks((b) => {
      const usable = b.filter((x) => x && x.blockData != null);
      if (usable.length === 0) {
        setError("No sections generated cleanly yet. Click Generate to try again before viewing the report.");
        setPhase("waiting");
        return b;
      }
      setCurrent(null);
      setError(null);
      setPhase("done");
      return b;
    });
  }, []);

  const reset = useCallback(() => {
    companyMetaRef.current = { company: "", industry: "Unknown", region: "Global" };
    briefRef.current = null;
    stepRef.current = 0;
    parseRetryRef.current = 0;
    setBlocks([]);
    setCurrent(null);
    setError(null);
    setPhase("idle");
  }, []);

  // Restore a saved report. If it's PARTIAL (fewer than 11 blocks), set the
  // step pointer to resume from the next section; if complete, go to "done".
  const restore = useCallback((savedBlocks, opts = {}) => {
    const arr = Array.isArray(savedBlocks) ? savedBlocks : [];
    const { company, industry, region, brief, resumable = true } = opts;
    parseRetryRef.current = 0;
    // If the saved report carried its research brief, reuse it so resuming
    // does NOT trigger another Brave search. Falls back to re-searching only
    // when no brief was stored (older entries).
    briefRef.current = (typeof brief === "string" && brief.trim()) ? brief.trim() : null;
    setBlocks(arr);
    setCurrent(null);
    setError(null);

    const lastStep = arr.length; // append-only: blocks are sections 1..N
    const isComplete = lastStep >= STEP_SPECS.length;

    if (isComplete || !resumable) {
      stepRef.current = STEP_SPECS.length;
      setPhase("done");
    } else {
      // Resume: set company meta so the next section can generate. If we
      // restored a brief above, the backend reuses it (no search); otherwise
      // it searches once.
      stepRef.current = lastStep; // next section index (0-based) = count so far
      companyMetaRef.current = {
        company: company || "",
        industry: industry || "Unknown",
        region: region || "Global",
      };
      setPhase("waiting");
    }
  }, []);

  const doneCount = blocks.length;
  const usableCount = blocks.filter((b) => b && b.blockData != null).length;
  const lastFailed = blocks.length > 0 && blocks[blocks.length - 1]?.blockData == null;
  const nextSpec = STEP_SPECS[stepRef.current];
  const nextStepName = nextSpec ? nextSpec.title : null;

  // Read the captured research brief (so App can persist it with the report).
  const getBrief = useCallback(() => briefRef.current || null, []);

  return {
    blocks, current, phase, error,
    doneCount, usableCount, lastFailed, nextStepNumber, nextStepName, totalSteps: STEP_SPECS.length,
    start, next, runStep, finishHere, reset, restore, getBrief,
  };
}
