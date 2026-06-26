// Parses the agent's structured output format out of a (possibly partial) text buffer.
//
// Expected shape:
//   STEP_NUMBER: 1
//   STEP_TITLE: ...
//   THOUGHT: ...
//   BLOCK_TYPE: HERO
//   BLOCK_DATA:
//   { ...json... }
//   STATUS: CONTINUE

// Sentinels written by the backend (see api/agent.js)
export const SEARCH_SENTINEL = "\u0000SEARCH\u0000";
export const ERROR_SENTINEL = "\u0000ERROR\u0000";
export const BRIEF_SENTINEL = "\u0000BRIEF\u0000";

export function stripSentinels(buffer) {
  let searching = false;
  let error = null;
  let brief = null;

  if (buffer.includes(SEARCH_SENTINEL)) {
    searching = true;
    buffer = buffer.split(SEARCH_SENTINEL).join("");
  }
  // The BRIEF sentinel carries the section-1 research brief as a trailing
  // payload; extract it and remove it from the parseable buffer.
  const briefIdx = buffer.indexOf(BRIEF_SENTINEL);
  if (briefIdx !== -1) {
    brief = buffer.slice(briefIdx + BRIEF_SENTINEL.length).trim();
    buffer = buffer.slice(0, briefIdx);
  }
  const errIdx = buffer.indexOf(ERROR_SENTINEL);
  if (errIdx !== -1) {
    error = buffer.slice(errIdx + ERROR_SENTINEL.length).trim();
    buffer = buffer.slice(0, errIdx);
  }
  return { buffer, searching, error, brief };
}

function extractField(buffer, label) {
  const re = new RegExp(`${label}:\\s*(.*)`, "i");
  const m = buffer.match(re);
  return m ? m[1].trim() : null;
}

// Pull the JSON object that follows "BLOCK_DATA:" — balanced-brace scan so we
// stop at the matching close brace even before STATUS has streamed in.
function extractBlockData(buffer) {
  let marker = buffer.search(/BLOCK_DATA:/i);
  let after;
  if (marker !== -1) {
    after = buffer.slice(marker + "BLOCK_DATA:".length);
  } else {
    // FALLBACK: some models (e.g. groq/compound) omit the literal BLOCK_DATA:
    // marker. Recover by scanning for JSON after the BLOCK_TYPE line, or — as a
    // last resort — anywhere in the buffer. This keeps parsing resilient to
    // looser formatting instead of failing the whole section.
    const typeIdx = buffer.search(/BLOCK_TYPE:/i);
    after = typeIdx !== -1 ? buffer.slice(typeIdx) : buffer;
  }

  const start = after.indexOf("{");
  const startArr = after.indexOf("[");
  let openChar = "{";
  let firstIdx = start;
  if (startArr !== -1 && (start === -1 || startArr < start)) {
    openChar = "[";
    firstIdx = startArr;
  }
  if (firstIdx === -1) return { raw: null, json: null };

  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;

  for (let i = firstIdx; i < after.length; i++) {
    const ch = after[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return { raw: after.slice(firstIdx), json: null }; // still streaming
  const raw = after.slice(firstIdx, end + 1);

  // Try strict parse first, then a lenient pass that repairs the most common
  // LLM JSON mistakes (trailing commas, smart quotes, stray code fences, and
  // raw newlines/tabs inside string values — common with groq/compound).
  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    try {
      let repaired = raw
        .replace(/```json|```/gi, "")           // stray code fences
        .replace(/[\u201C\u201D]/g, '"')         // smart double quotes
        .replace(/[\u2018\u2019]/g, "'")         // smart single quotes
        .replace(/,\s*([}\]])/g, "$1");          // trailing commas before } or ]
      repaired = escapeRawControlCharsInStrings(repaired);
      return { raw, json: JSON.parse(repaired) };
    } catch {
      return { raw, json: null };
    }
  }
}

// Escape literal newlines / carriage returns / tabs that appear INSIDE JSON
// string values (which is invalid JSON). Models like groq/compound sometimes
// emit multi-line bullet text without escaping it, breaking JSON.parse. We walk
// the text tracking whether we're inside a string, and escape control chars
// only there — structural whitespace between tokens is left untouched.
function escapeRawControlCharsInStrings(s) {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { out += ch; escape = false; continue; }
    if (ch === "\\") { out += ch; escape = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

// Returns a structured snapshot of whatever is parseable so far.
export function parseStep(buffer) {
  const { buffer: clean, searching, error, brief } = stripSentinels(buffer);

  const stepNumber = extractField(clean, "STEP_NUMBER");
  const stepTitle = extractField(clean, "STEP_TITLE");
  const thought = extractField(clean, "THOUGHT");
  const blockType = extractField(clean, "BLOCK_TYPE");
  const statusRaw = extractField(clean, "STATUS");
  const { json: blockData } = extractBlockData(clean);

  const status =
    statusRaw && /done/i.test(statusRaw)
      ? "DONE"
      : statusRaw && /continue/i.test(statusRaw)
      ? "CONTINUE"
      : null;

  return {
    searching,
    error,
    brief, // section-1 research brief (null otherwise)
    stepNumber: stepNumber ? parseInt(stepNumber, 10) : null,
    stepTitle,
    thought,
    blockType: blockType ? blockType.toUpperCase() : null,
    blockData, // parsed JSON or null while still streaming
    status, // "CONTINUE" | "DONE" | null
    complete: blockData !== null && status !== null,
  };
}
