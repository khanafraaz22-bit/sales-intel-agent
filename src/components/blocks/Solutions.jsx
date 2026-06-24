import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function Solutions({ data }) {
  if (!data?.solutions) return null;
  return (
    <div className="space-y-3">
      {data.solutions.map((s, i) => (
        <motion.div key={i} variants={staggerItem} whileHover={{ scale: 1.01 }} className="panel p-5">
          <h3 className="font-semibold ink">{s.name}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><div className="eyebrow" style={{ color: "var(--red)" }}>Problem Solved</div><p className="mt-1 text-sm ink-soft">{s.problem_solved}</p></div>
            <div><div className="eyebrow" style={{ color: "var(--green)" }}>Business Impact</div><p className="mt-1 text-sm ink-soft">{s.impact}</p></div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
