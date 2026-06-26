import { motion } from "framer-motion";

const STEP_NAMES = [
  "Company Snapshot", "Financial Signals", "Business Model", "Operations",
  "Technology Stack", "Pain Points", "Opportunity Map", "Analyst Insights",
  "Solution Stack", "Buyer Personas", "Strategy Roadmap",
];

// Manual step-by-step generation view.
// Props:
//   company, doneCount, usableCount, lastFailed, current, error
//   running  — a section is currently streaming
//   onNext   — generate the next section (or retry current on error/waiting)
//   onFinish — stop here and view the report with the sections done so far
export default function Generating({ company, doneCount, usableCount = doneCount, lastFailed = false, current, error, running, onNext, onFinish }) {
  const pct = Math.round((doneCount / 11) * 100);
  const allDone = doneCount >= 11;
  const nextName = STEP_NAMES[doneCount];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="eyebrow" style={{ color: "var(--teal)" }}>Building Intelligence Profile</div>
      <h1 className="font-display mt-2 text-4xl font-bold ink">{company}</h1>

      {/* progress ring */}
      <div className="relative mt-8">
        <svg width="120" height="120" className="-rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
          <motion.circle
            cx="60" cy="60" r="52" fill="none" stroke="var(--teal)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - doneCount / 11) }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold ink">{pct}%</span>
          <span className="font-mono text-[10px] ink-faint">{doneCount}/11</span>
        </div>
      </div>

      {/* status line */}
      <div className="mt-6 h-5">
        {running ? (
          <span className="flex items-center justify-center gap-2 text-sm ink-soft">
            <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
              className="h-2 w-2 rounded-full" style={{ background: "var(--teal)" }} />
            {current?.searching ? "Searching the web…" : `Generating ${nextName || "section"}…`}
          </span>
        ) : error ? (
          <span className="font-mono text-sm" style={{ color: "var(--red)" }}>Paused</span>
        ) : allDone ? (
          <span className="font-mono text-sm" style={{ color: "var(--teal)" }}>All sections complete</span>
        ) : (
          <span className="font-mono text-sm ink-soft">
            {doneCount === 0 ? "Ready to begin" : `${doneCount} of 11 done — ready for next`}
          </span>
        )}
      </div>

      {/* step checklist */}
      <div className="mt-8 grid w-full grid-cols-1 gap-1.5">
        {STEP_NAMES.map((name, i) => {
          const state = i < doneCount ? "done" : i === doneCount ? "active" : "pending";
          return (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
              style={{ background: state === "active" ? "var(--surface)" : "transparent", opacity: state === "pending" ? 0.4 : 1 }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]"
                style={{
                  background: state === "done" ? "var(--teal)" : "var(--surface-2)",
                  color: state === "done" ? "var(--bg)" : "var(--ink-faint)",
                }}>
                {state === "done" ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span className={state === "done" ? "ink" : "ink-soft"}>{name}</span>
              {state === "active" && running && !error && (
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }}
                  className="ml-auto font-mono text-[10px]" style={{ color: "var(--teal)" }}>running</motion.span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-6 w-full rounded-lg p-4 text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {/* If the last section came back unusable, say so plainly. */}
      {!error && lastFailed && !running && (
        <div className="mt-6 w-full rounded-lg p-4 text-sm" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
          The last section didn't generate cleanly. Click Generate to retry it before continuing.
        </div>
      )}

      {/* manual controls */}
      <div className="mt-8 flex w-full flex-col items-center gap-3">
        {!allDone && (
          <motion.button
            whileHover={{ scale: running ? 1 : 1.03 }} whileTap={{ scale: running ? 1 : 0.97 }}
            onClick={onNext} disabled={running}
            className="font-mono w-full rounded-lg py-3 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
            style={{ background: "var(--teal)", color: "var(--bg)" }}>
            {running
              ? "Working…"
              : (error || lastFailed)
              ? `Retry ${nextName || "section"}`
              : doneCount === 0
              ? "Generate first section"
              : `Generate next section · ${nextName || ""}`}
          </motion.button>
        )}

        {/* Finish early — only when at least one USABLE section exists */}
        {usableCount > 0 && (
          <button onClick={onFinish} disabled={running}
            className="font-mono rounded-lg border px-5 py-2.5 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal disabled:opacity-40"
            style={{ borderColor: "var(--border)" }}>
            {allDone ? "View full report" : `View report so far (${usableCount}/11)`}
          </button>
        )}
      </div>
    </div>
  );
}