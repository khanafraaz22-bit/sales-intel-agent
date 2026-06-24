import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
const sev = {
  high: { color: "var(--red)", bg: "var(--red-soft)", label: "HIGH" },
  medium: { color: "var(--amber)", bg: "var(--amber-soft)", label: "MED" },
  low: { color: "var(--ink-soft)", bg: "var(--surface-2)", label: "LOW" },
};
export default function PainPoints({ data }) {
  if (!data?.points) return null;
  return (
    <div className="panel divide-y overflow-hidden">
      {data.points.map((p, i) => {
        const s = sev[p.severity] || sev.medium;
        return (
          <motion.div key={i} variants={staggerItem} className="flex items-start gap-3 p-4">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <div className="flex-1">
              <h3 className="font-semibold ink">{p.title}</h3>
              <p className="mt-1 text-sm ink-soft">{p.description}</p>
            </div>
            <span className="font-mono rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: s.bg, color: s.color }}>{s.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
