import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function CardGrid({ data }) {
  if (!data?.cards) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.cards.map((card, i) => (
        <motion.div key={i} variants={staggerItem} whileHover={{ y: -5, scale: 1.02 }} className="panel p-5">
          <h3 className="eyebrow" style={{ color: "var(--blue)" }}>{card.title}</h3>
          <ul className="mt-3 space-y-2">
            {(card.bullets || []).map((b, j) => (
              <li key={j} className="flex gap-2 text-sm ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--blue)" }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
