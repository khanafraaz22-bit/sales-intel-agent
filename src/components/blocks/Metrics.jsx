import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
const signal = {
  positive: { color: "var(--green)", bg: "var(--green-soft)" },
  neutral: { color: "var(--ink-soft)", bg: "var(--surface-2)" },
  negative: { color: "var(--red)", bg: "var(--red-soft)" },
};
export default function Metrics({ data }) {
  if (!data?.items) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {data.items.map((item, i) => {
        const s = signal[item.signal] || signal.neutral;
        return (
          <motion.div key={i} variants={staggerItem} whileHover={{ y: -4, scale: 1.03 }} className="panel p-4">
            <div className="eyebrow">{item.label}</div>
            <div className="tabular mt-2 font-mono text-lg font-semibold" style={{ color: s.color }}>{item.value}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
