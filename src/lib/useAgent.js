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

// ── InfraBeat capability profile (the vendor this report sells for) ──
// Source of truth for how sections 12-13 frame InfraBeat's fit. Update here
// when the positioning is refined; both pain-mapping and roadmap reference it.
const INFRABEAT = "InfraBeat Technologies (Pune-based SAP + cloud + AI consultancy, ~650 staff, 300+ engagements, 15+ countries). Capabilities: SAP S/4HANA migrations, SAP BTP, SAP Ariba (procurement), SAP SuccessFactors (HR), SAP Analytics Cloud, SAP Basis, ABAP, Fiori, AMS (application management), and SAP iRPA; plus cloud migration on AWS/Azure/Google Cloud, data engineering, AI & advanced analytics, Power BI/Tableau dashboards, DevOps, and enterprise automation. Positioned as a long-term digital-transformation partner, not just an implementer.";

// ── EXPLICIT STEP SEQUENCE (code-enforced) ──────────────────────
// We tell the model EXACTLY which step, block type, and title to emit each turn.
// The server-side order is the source of truth, not the model's memory.
const STEP_SPECS = [
  { n: 1, type: "HERO", title: "Executive Summary & Value Proposition",
    inst: "Establish the company's identity, scale, industry, market position, and the sharpest value proposition. Include key_locations: an array of 4-8 major cities where this company actually operates (HQ, key markets, major sites/plants/offices), each as \"City, Country\". key_insight should capture the core strategic story; sales_angle should frame the headline opportunity for a digital-transformation / SAP & cloud partner." },
  { n: 2, type: "METRICS", title: "Financial Health & Revenue Trajectory",
    inst: "Revenue range and recent trajectory (last ~2-3 years), growth rate, headcount, profitability/margin signal, and digital maturity. Use real figures where known; mark estimates as approximate." },
  { n: 3, type: "CARD_GRID", title: "Core Operations & Business Model",
    inst: "Exactly 4 cards: Primary Business Activities, Revenue Streams & Segments, Operating Footprint & Scale, Key Operational Risks. Adapt to the company's actual industry (manufacturing, services, retail, utilities, pharma, public sector, etc.)." },
  { n: 4, type: "CARD_GRID", title: "Production / Service Delivery Infrastructure",
    inst: "Exactly 4 cards: Production or Service-Delivery Model, Capacity & Key Sites/Facilities, In-house vs Outsourced Split, Delivery/Production Risks. For a manufacturer cover plants; for a service firm cover delivery centers; adapt to the industry." },
  { n: 5, type: "CARD_GRID", title: "Distribution & Customer Channels",
    inst: "Exactly 4 cards: Go-to-Market & Channels, Customer Segments Served, Geographic Reach, Channel / Customer-Experience Gaps. Adapt to the industry (B2B, B2C, wholesale, direct, public, etc.)." },
  { n: 6, type: "CARD_GRID", title: "Supply Chain & Procurement Ecosystem",
    inst: "Exactly 4 cards: Supplier Base & Sourcing Geographies, Procurement Model & Systems (note any SAP Ariba / e-procurement signals), Supply Chain Visibility/Maturity, Key Supply Chain Risks." },
  { n: 7, type: "CARD_GRID", title: "Logistics & Fulfillment Dynamics",
    inst: "Exactly 4 cards: Fulfillment / Distribution Model, Transportation & Last-Mile (where relevant), Inventory & Warehousing Approach, Logistics Technology & Gaps. Adapt to the industry; skip last-mile for non-physical businesses and cover service logistics instead." },
  { n: 8, type: "CARD_GRID", title: "Technology Landscape",
    inst: "Exactly 4 cards: Core Platforms (ERP, CRM, industry systems), Known Integrations & Data Estate, Technology Gaps & Legacy Debt, Digital Maturity Level. Note current ERP (especially any SAP footprint) and modernization signals." },
  { n: 9, type: "CARD_GRID", title: "Digital, Data & Automation Maturity",
    inst: "Exactly 4 cards: Digital/Customer-Facing Systems, Data & Analytics Maturity (BI, reporting, dashboards), Automation & AI Adoption, Integration & Digital Gaps. This surfaces opportunities for analytics, AI, and automation partners." },
  { n: 10, type: "CARD_GRID", title: "Sustainability, CSR & Compliance Profile",
    inst: "Exactly 4 cards: Sustainability Commitments & Targets, CSR Initiatives, Regulatory/Compliance Exposure, ESG Reporting Maturity." },
  { n: 11, type: "DECISION_MAKERS", title: "Decision-Maker Intelligence",
    inst: "Real top decision-makers (CEO, Founder, CFO, CTO, COO, President, etc.) for this company, sourced from public LinkedIn profiles. Each entry: name, title, and LinkedIn profile URL. Do not invent people — only real, linkable profiles." },
  { n: 12, type: "PAIN_POINTS", title: "Pain Points & InfraBeat Opportunity Matrix",
    inst: `4-6 specific, evidence-based pain points tied to this company's operations, technology, supply chain, procurement, HR, analytics, or cloud estate. For each, the description should connect the pain to a concrete InfraBeat capability that addresses it. ${INFRABEAT} Map each pain to the most relevant InfraBeat service (e.g. legacy ERP → S/4HANA migration; procurement inefficiency → SAP Ariba; HR/talent → SuccessFactors; fragmented reporting → SAP Analytics Cloud / Power BI / Tableau; infrastructure cost → AWS/Azure/GCP cloud migration; manual processes → iRPA automation). Severity reflects real business impact.` },
  { n: 13, type: "ROADMAP", title: "Strategic Recommendations & Roadmap",
    inst: `3 phases (e.g. Assess & Align, Modernize Core, Innovate & Scale), 3-4 tailored actions each, framed as InfraBeat's recommended engagement path for this company. ${INFRABEAT} Actions should draw on InfraBeat's real services (SAP S/4HANA/BTP/Ariba/SuccessFactors/SAC, cloud migration on AWS/Azure/GCP, data engineering, AI/analytics, Power BI/Tableau, iRPA automation, AMS) and be specific to this company's situation. Set STATUS: DONE.` },
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
export function useAgent({ getGroqKey, getToken, getSettings } = {}) {
  // Resolve the EFFECTIVE spec for an index, applying admin settings overrides:
  // a custom title (title_overrides[n]) and the current InfraBeat positioning
  // text substituted into the instruction (the default text is a placeholder
  // token the settings value replaces).
  const effectiveSpec = (idx) => {
    const spec = STEP_SPECS[idx];
    if (!spec) return spec;
    const s = getSettings ? getSettings() : null;
    const titleOverride = s?.title_overrides?.[String(spec.n)];
    const ibText = (s?.infrabeat_text && s.infrabeat_text.trim()) ? s.infrabeat_text.trim() : INFRABEAT;
    return {
      ...spec,
      title: titleOverride || spec.title,
      inst: spec.inst.split(INFRABEAT).join(ibText), // swap InfraBeat text if present
    };
  };
  const [blocks, setBlocks] = useState([]);     // completed step snapshots
  const [current, setCurrent] = useState(null); // the step currently streaming
  const [phase, setPhase] = useState("idle");   // idle | running | waiting | done | error
  const [error, setError] = useState(null);
  // Whether this report is web-grounded (a Brave brief was fetched/used) vs.
  // built from model knowledge alone. Honest provenance signal for the UI.
  const [grounded, setGrounded] = useState(false);

  const companyMetaRef = useRef({ company: "", industry: "Unknown", region: "Global" });
  const briefRef = useRef(null);                 // section-1 research brief (reused 2..11)
  const stepRef = useRef(0);                     // 0-based index into STEP_SPECS
  const parseRetryRef = useRef(0);               // retries for a failed parse
  // Selected section numbers (1-based). Empty/null = all sections. When a
  // subset is chosen, generation walks only those, in their natural order.
  const selectedRef = useRef(null);

  // Is a given STEP_SPECS index selected? (true when no selection = all.)
  const isSelected = (idx) => {
    const sel = selectedRef.current;
    if (!sel || sel.size === 0) return true;
    const spec = STEP_SPECS[idx];
    return spec ? sel.has(spec.n) : false;
  };
  // Advance stepRef to the next SELECTED step at/after the given index.
  // Returns the index, or STEP_SPECS.length if none remain.
  const nextSelectedFrom = (idx) => {
    let i = idx;
    while (i < STEP_SPECS.length && !isSelected(i)) i++;
    return i;
  };
  // Is this the last selected step? (no selected steps after it)
  const isLastSelected = (idx) => nextSelectedFrom(idx + 1) >= STEP_SPECS.length;

  // doneCount derives from blocks; nextStepNumber is 1-based for display.
  const nextStepNumber = stepRef.current + 1;

  // Build the structured request body for the CURRENT step. The backend runs
  // the two-stage (search → format) pipeline; we pass the cached brief so it
  // only searches on section 1.
  const buildRequestBody = useCallback((groqKey) => {
    const spec = effectiveSpec(stepRef.current);
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
      isLast: isLastSelected(stepRef.current),
      searchBrief: briefRef.current || undefined, // present after the first run
    };
  }, []);

  // Run exactly ONE step, then stop in "waiting" (or "done" on the last step).
  const runStep = useCallback(async () => {
    const spec = effectiveSpec(stepRef.current);
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
    // backend then skips the search stage entirely). The presence of a brief
    // is our honest signal that this report is WEB-GROUNDED (Brave provided
    // real context) vs. built from the model's own knowledge.
    if (parsed && parsed.brief && !briefRef.current) {
      briefRef.current = parsed.brief;
      setGrounded(true);
    }

    if (parsed && parsed.blockData) {
      // Stamp the block with the AUTHORITATIVE step number + title from the
      // spec (not whatever the model echoed in STEP_TITLE), and dedup by step
      // number so a retry or stray duplicate replaces the slot instead of
      // appending a second card section with a drifted title.
      const stamped = { ...parsed, stepNumber: spec.n, stepTitle: spec.title, blockType: spec.type };
      setBlocks((b) => {
        const without = b.filter((x) => x.stepNumber !== spec.n);
        const next = [...without, stamped];
        next.sort((x, y) => (x.stepNumber || 0) - (y.stepNumber || 0));
        return next;
      });
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

    const lastSel = isLastSelected(stepRef.current);
    const isDone = parsed?.status === "DONE" || lastSel;

    // Advance the pointer to the next SELECTED step for the next manual click.
    stepRef.current = nextSelectedFrom(stepRef.current + 1);

    if (isDone || stepRef.current >= STEP_SPECS.length) {
      setPhase("done");
    } else {
      // MANUAL: stop and wait for the user to click "Generate next section".
      setPhase("waiting");
    }
  }, [buildRequestBody, getGroqKey, getToken]);

  // Kick off a fresh analysis. `selectedSteps` (optional) = array of 1-based
  // section numbers to generate; omit/empty = all 13. Generates the first
  // selected section, then waits.
  const start = useCallback(
    ({ company, industry, region, selectedSteps }) => {
      // Set the selection (null = all).
      selectedRef.current = (Array.isArray(selectedSteps) && selectedSteps.length)
        ? new Set(selectedSteps)
        : null;
      parseRetryRef.current = 0;
      briefRef.current = null; // fresh company → fresh search on the first section
      setGrounded(false);
      setBlocks([]);
      setCurrent(null);
      setError(null);
      companyMetaRef.current = {
        company,
        industry: industry || "Unknown",
        region: region || "Global",
      };
      // Start at the FIRST selected step (not always index 0).
      stepRef.current = nextSelectedFrom(0);
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
    setGrounded(false);
    stepRef.current = 0;
    parseRetryRef.current = 0;
    selectedRef.current = null;
    setBlocks([]);
    setCurrent(null);
    setError(null);
    setPhase("idle");
  }, []);

  // Restore a saved report. If it's PARTIAL (fewer blocks than STEP_SPECS),
  // set the step pointer to resume from the next section; if complete → "done".
  const restore = useCallback((savedBlocks, opts = {}) => {
    const arr = Array.isArray(savedBlocks) ? savedBlocks : [];
    const { company, industry, region, brief, resumable = true } = opts;
    parseRetryRef.current = 0;
    selectedRef.current = null; // resuming → allow generating any remaining section
    // If the saved report carried its research brief, reuse it so resuming
    // does NOT trigger another Brave search. Falls back to re-searching only
    // when no brief was stored (older entries).
    briefRef.current = (typeof brief === "string" && brief.trim()) ? brief.trim() : null;
    setGrounded(Boolean(briefRef.current));
    setBlocks(arr);
    setCurrent(null);
    setError(null);

    // Which section numbers already exist? (blocks may be non-contiguous if the
    // saved report was generated from a custom selection.)
    const have = new Set(arr.map((b) => b.stepNumber).filter(Boolean));
    const isComplete = have.size >= STEP_SPECS.length;

    if (isComplete || !resumable) {
      stepRef.current = STEP_SPECS.length;
      setPhase("done");
    } else {
      // Resume at the first STEP_SPECS index whose number isn't present yet.
      let idx = 0;
      while (idx < STEP_SPECS.length && have.has(STEP_SPECS[idx].n)) idx++;
      stepRef.current = idx;
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
  const nextSpec = STEP_SPECS[stepRef.current] ? effectiveSpec(stepRef.current) : null;
  const nextStepName = nextSpec ? nextSpec.title : null;
  // Apply admin title overrides to the catalogs shown in the UI.
  const settingsNow = getSettings ? getSettings() : null;
  const titleFor = (spec) => settingsNow?.title_overrides?.[String(spec.n)] || spec.title;
  const stepNames = STEP_SPECS.map((s) => titleFor(s));
  // Section catalog for the pre-generation picker: [{ n, title }].
  const allSections = STEP_SPECS.map((s) => ({ n: s.n, title: titleFor(s), defaultTitle: s.title }));
  // Effective total for progress display: the number of SELECTED sections
  // (or all 13 when nothing specific was chosen).
  const effectiveTotal = (selectedRef.current && selectedRef.current.size)
    ? selectedRef.current.size
    : STEP_SPECS.length;

  // Read the captured research brief (so App can persist it with the report).
  const getBrief = useCallback(() => briefRef.current || null, []);

  return {
    blocks, current, phase, error, grounded,
    doneCount, usableCount, lastFailed, nextStepNumber, nextStepName, stepNames, allSections, totalSteps: STEP_SPECS.length,
    effectiveTotal,
    start, next, runStep, finishHere, reset, restore, getBrief,
  };
}
