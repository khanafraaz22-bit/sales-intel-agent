import { motion } from "framer-motion";
import { staggerItem } from "../../lib/motion.js";
export default function Table({ data }) {
  if (!data?.columns) return null;
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="surface-2">
            {data.columns.map((c, i) => <th key={i} className="eyebrow px-4 py-3">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((row, i) => (
            <motion.tr key={i} variants={staggerItem} className="border-t">
              {(row.cells || []).map((cell, j) => <td key={j} className="px-4 py-3 ink">{cell}</td>)}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
