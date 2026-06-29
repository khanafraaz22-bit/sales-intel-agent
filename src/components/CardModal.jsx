import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

// ── Click-to-expand card system ─────────────────────────────────
// Cards in the dashboard truncate content for layout. ExpandableCard wraps any
// card so that clicking it opens CardModal with the FULL untruncated data plus
// the company + section context. Click outside, press Esc, or hit ✕ to close.

// Renders the full content of a card based on its `kind`. Each kind maps to one
// of the report's JSON shapes so nothing is truncated here.
function CardBody({ kind, data }) {
  if (kind === "bullets") {
    const bullets = data.bullets || [];
    return (
      <ul className="space-y-2.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed ink-soft">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--teal)" }} />
            <span>{b}</span>
          </li>
        ))}
        {bullets.length === 0 && <li className="text-sm ink-faint">No details were generated for this card.</li>}
      </ul>
    );
  }

  if (kind === "solution") {
    return (
      <div className="space-y-4">
        <div>
          <div className="eyebrow" style={{ color: "var(--teal)" }}>Problem Solved</div>
          <p className="mt-1 text-sm leading-relaxed ink-soft">{data.problem_solved || "—"}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
          <div className="eyebrow" style={{ color: "var(--green)" }}>Business Impact</div>
          <p className="mt-1 text-sm leading-relaxed ink">{data.impact || "—"}</p>
        </div>
      </div>
    );
  }

  if (kind === "persona") {
    return (
      <div className="space-y-4">
        <div>
          <div className="eyebrow" style={{ color: "var(--teal)" }}>Focus</div>
          <p className="mt-1 text-sm leading-relaxed ink-soft">{data.focus || "—"}</p>
        </div>
        <div>
          <div className="eyebrow" style={{ color: "var(--purple)" }}>Motivation</div>
          <p className="mt-1 text-sm leading-relaxed ink-soft">{data.motivation || "—"}</p>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--red)", background: "var(--red-soft)" }}>
          <div className="eyebrow" style={{ color: "var(--red)" }}>Likely Objection</div>
          <p className="mt-1 text-sm italic leading-relaxed ink">"{data.objection || "—"}"</p>
        </div>
      </div>
    );
  }

  if (kind === "phase") {
    const actions = data.actions || [];
    return (
      <ul className="space-y-2.5">
        {actions.map((a, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed ink-soft">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--green)" }} />
            <span>{a}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (kind === "pain") {
    const sevColor = data.severity === "high" ? "var(--red)" : data.severity === "medium" ? "var(--amber)" : "var(--teal)";
    return (
      <div className="space-y-3">
        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide"
          style={{ background: "var(--surface-2)", color: sevColor }}>
          {data.severity || "—"} severity
        </span>
        <p className="text-sm leading-relaxed ink-soft">{data.description || "—"}</p>
      </div>
    );
  }

  // Fallback: dump any string fields.
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([k, v]) =>
        typeof v === "string" ? (
          <div key={k}>
            <div className="eyebrow">{k.replace(/_/g, " ")}</div>
            <p className="mt-0.5 text-sm leading-relaxed ink-soft">{v}</p>
          </div>
        ) : null
      )}
    </div>
  );
}

export function CardModal({ open, onClose, title, company, section, kind, data }) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, var(--bg) 70%, transparent)", backdropFilter: "blur(6px)" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="card relative w-full max-w-lg p-6"
            style={{ background: "var(--surface)", maxHeight: "82vh", overflowY: "auto" }}>
            {/* close */}
            <button onClick={onClose} aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-sm ink-faint transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">
              ✕
            </button>

            {/* context */}
            <div className="eyebrow" style={{ color: "var(--teal)" }}>
              {company}{section ? ` · ${section}` : ""}
            </div>
            <h2 className="font-display mt-1 pr-8 text-xl font-bold ink">{title}</h2>

            <div className="mt-5">
              <CardBody kind={kind} data={data} />
            </div>

            <div className="mt-6 text-center text-xs ink-faint">Click outside or press Esc to close</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Wraps card markup to make it clickable. Pass the modal payload via `modal`.
export function ExpandableCard({ children, onExpand, className = "" }) {
  return (
    <div
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onExpand())}
      className={`cursor-pointer ${className}`}
      title="Click to see full details">
      {children}
    </div>
  );
}
