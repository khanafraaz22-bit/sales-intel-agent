import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function Insights({ data }) {
  if (!data?.insights) return null;
  return (
    <div className="panel p-5">
      <ul className="space-y-3">
        {data.insights.map((ins, i) => (
          <motion.li key={i} variants={staggerItem} className="flex gap-3 text-sm ink">
            <span className="font-mono flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="pt-0.5 leading-relaxed">{ins}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
