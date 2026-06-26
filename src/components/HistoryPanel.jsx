import { motion, AnimatePresence } from "framer-motion";

function timeAgo(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000; // seconds
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
function fullStamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoryPanel({ open, onToggle, items, loading, onRestore, onDelete }) {
  return (
    <div className="mx-auto mt-8 max-w-3xl px-4">
      <div className="flex justify-center">
        <button onClick={onToggle}
          className="font-mono flex items-center gap-2 rounded-lg border px-4 py-2 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal"
          style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" />
          </svg>
          {open ? "Hide History" : "Show History"}
          {items.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--surface-2)", color: "var(--teal)" }}>{items.length}</span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="mt-4 space-y-2">
              <div className="eyebrow text-center" style={{ color: "var(--teal)" }}>Your Search History</div>

              {loading && <p className="text-body py-4 text-center text-sm ink-faint">Loading history…</p>}

              {!loading && items.length === 0 && (
                <p className="text-body py-6 text-center text-sm ink-faint">
                  No saved reports yet. Reports you generate are saved here automatically.
                </p>
              )}

              {!loading && items.map((r) => (
                <motion.div key={r.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="card card-glow group flex items-center justify-between gap-3 p-4">
                  <button onClick={() => onRestore(r)} className="flex flex-1 items-center gap-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", color: "var(--teal)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-sm font-bold ink">{r.company}</span>
                      <span className="font-mono text-xs ink-faint" title={fullStamp(r.created_at)}>
                        {(() => {
                          const done = (r.blocks || []).filter((b) => b && b.blockData != null).length;
                          const label = done >= 11 ? "Complete" : `${done}/11 · resume`;
                          return <><span style={{ color: done >= 11 ? "var(--green)" : "var(--teal)" }}>{label}</span> · {timeAgo(r.created_at)}</>;
                        })()}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono hidden text-[10px] uppercase tracking-wide ink-faint sm:inline">Open</span>
                    <button onClick={() => onDelete(r.id)} title="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-lg ink-faint transition hover:text-red"
                      style={{ background: "var(--surface-2)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
   );
}