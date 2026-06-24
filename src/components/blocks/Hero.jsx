import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function Hero({ data }) {
  if (!data) return null;
  return (
    <div className="panel overflow-hidden">
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{data.industry}</span>
          <span className="ink-faint">·</span>
          <span className="eyebrow">{data.region}</span>
          <span className="ml-auto rounded-md px-2 py-1 text-xs font-semibold" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>{data.growth_stage}</span>
        </div>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className="font-display mt-2 text-4xl font-bold ink">
          {data.company_name}
        </motion.h1>
      </div>
      <div className="grid gap-px sm:grid-cols-2" style={{ background: "var(--border)" }}>
        <motion.div variants={staggerItem} className="surface p-5">
          <div className="eyebrow">Key Insight</div>
          <p className="mt-2 text-sm leading-relaxed ink">{data.key_insight}</p>
        </motion.div>
        <motion.div variants={staggerItem} className="surface p-5">
          <div className="eyebrow" style={{ color: "var(--green)" }}>Sales Angle</div>
          <p className="mt-2 text-sm leading-relaxed ink">{data.sales_angle}</p>
        </motion.div>
      </div>
    </div>
  );
}
