import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function Personas({ data }) {
  if (!data?.personas) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.personas.map((p, i) => (
        <motion.div key={i} variants={staggerItem} whileHover={{ y: -5, scale: 1.02 }} className="panel p-5">
          <h3 className="font-semibold ink">{p.role}</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            <div><span className="eyebrow">Focus </span><span className="ink-soft">{p.focus}</span></div>
            <div><span className="eyebrow">Motivation </span><span className="ink-soft">{p.motivation}</span></div>
          </div>
          <div className="mt-3 rounded-lg p-3" style={{ background: "var(--amber-soft)" }}>
            <div className="eyebrow" style={{ color: "var(--amber)" }}>Likely Objection</div>
            <p className="mt-1 text-sm ink">{p.objection}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
