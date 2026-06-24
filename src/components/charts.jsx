import { motion } from "framer-motion";

// Horizontal labelled progress bar (Cloud Adoption: Advanced, etc.)
export function ProgressBar({ label, level, value, color = "var(--green)" }) {
  // value 0-100; if only a level word is given, map it.
  const levelMap = { Emerging: 35, Developing: 50, Advanced: 78, Leading: 92, High: 80, Medium: 55, Low: 30 };
  const pct = value != null ? value : levelMap[level] ?? 60;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="ink-soft">{label}</span>
        <span className="font-mono ink" style={{ color }}>{level || `${pct}%`}</span>
      </div>
      <div className="track mt-1.5 h-1.5">
        <motion.div
          initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full" style={{ background: color }}
        />
      </div>
    </div>
  );
}

// Percentage row with a filled bar (revenue streams: Consumer 42%)
export function PercentRow({ label, sublabel, pct, color = "var(--teal)" }) {
  return (
    <div className="card card-glow p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium ink">{label}</div>
          {sublabel && <div className="text-xs ink-faint">{sublabel}</div>}
        </div>
        {pct != null && <span className="font-mono text-sm" style={{ color }}>{pct}%</span>}
      </div>
      {pct != null && (
        <div className="track mt-2 h-1">
          <motion.div
            initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full" style={{ background: color }}
          />
        </div>
      )}
    </div>
  );
}

// Radial gauge (efficiency %, sync %)
export function Gauge({ value = 80, label, color = "var(--teal)", size = 64 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: off }} viewport={{ once: true }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <span className="-mt-1 font-mono text-xs" style={{ color }}>{value}%</span>
      {label && <span className="mt-0.5 text-[10px] ink-faint">{label}</span>}
    </div>
  );
}

// Pill / status badge
export function Pill({ children, color = "var(--teal)", soft = "var(--teal-soft)" }) {
  return (
    <span className="font-mono rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: soft, color }}>
      {children}
    </span>
  );
}

// ── Donut chart (e.g. revenue stream split) ──
export function Donut({ segments, size = 140 }) {
  // segments: [{label, value, color}]
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90 shrink-0">
        {segments.map((s, i) => {
          const frac = (s.value || 0) / total;
          const dash = frac * c;
          const seg = (
            <motion.circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth="14"
              strokeDasharray={`${dash} ${c - dash}`}
              initial={{ strokeDashoffset: -offset, opacity: 0 }}
              whileInView={{ strokeDashoffset: -offset, opacity: 1 }} viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.1 }} />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="ink-soft">{s.label}</span>
            <span className="font-mono tabular ink">{Math.round(((s.value || 0) / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal bar chart (e.g. metric comparison) ──
export function BarChart({ bars }) {
  // bars: [{label, value, color, display}]  value 0-100
  const max = Math.max(...bars.map((b) => b.value || 0), 1);
  return (
    <div className="space-y-3">
      {bars.map((b, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="ink-soft">{b.label}</span>
            <span className="font-mono tabular" style={{ color: b.color || "var(--teal)" }}>{b.display ?? b.value}</span>
          </div>
          <div className="track h-2">
            <motion.div initial={{ width: 0 }} whileInView={{ width: `${((b.value || 0) / max) * 100}%` }} viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: b.color || "var(--teal)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Severity distribution (stacked segment bar for pain points) ──
export function SeverityBar({ high = 0, medium = 0, low = 0 }) {
  const total = high + medium + low || 1;
  const seg = [
    { n: high, c: "var(--red)", label: "High" },
    { n: medium, c: "var(--amber)", label: "Medium" },
    { n: low, c: "var(--ink-faint)", label: "Low" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {seg.map((s, i) => s.n > 0 && (
          <motion.div key={i} initial={{ width: 0 }} whileInView={{ width: `${(s.n / total) * 100}%` }} viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.1 }} style={{ background: s.c }} />
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs">
        {seg.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.c }} />
            <span className="ink-soft">{s.label}</span>
            <span className="font-mono tabular ink">{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
