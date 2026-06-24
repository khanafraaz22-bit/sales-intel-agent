import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function Roadmap({ data }) {
  if (!data?.phases) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {data.phases.map((phase, i) => (
        <motion.div key={i} variants={staggerItem} whileHover={{ y: -5, scale: 1.02 }} className="panel p-5">
          <div className="flex items-center gap-2">
            <span className="font-mono flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white" style={{ background: "var(--blue)" }}>{String(i + 1).padStart(2, "0")}</span>
            <h3 className="font-semibold ink">{phase.phase}</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {(phase.actions || []).map((a, j) => (
              <li key={j} className="flex gap-2 text-sm ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--green)" }} />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
