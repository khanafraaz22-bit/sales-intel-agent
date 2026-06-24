import { motion } from "framer-motion";

const STEP_NAMES = [
  "Company Snapshot", "Financial Signals", "Business Model", "Operations",
  "Technology Stack", "Pain Points", "Opportunity Map", "Analyst Insights",
  "Solution Stack", "Buyer Personas", "Strategy Roadmap",
];

export default function Generating({ company, doneCount, current, cooldown, error, onRetry }) {
  const pct = Math.round((doneCount / 11) * 100);
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

      {/* current step */}
      <div className="mt-6 h-5">
        {cooldown > 0 ? (
          <span className="font-mono text-sm ink-soft">Cooling down {cooldown}s…</span>
        ) : (
          <span className="flex items-center justify-center gap-2 text-sm ink-soft">
            <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
              className="h-2 w-2 rounded-full" style={{ background: "var(--teal)" }} />
            {error ? "Paused" : STEP_NAMES[doneCount] || "Finishing…"}
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
              {state === "active" && !error && (
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
          {onRetry && (
            <button onClick={onRetry} className="ml-3 font-mono text-xs underline">Retry</button>
          )}
        </div>
      )}
    </div>
  );
}
