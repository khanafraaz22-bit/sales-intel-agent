import { useState } from "react";
import { motion } from "framer-motion";

const TRENDING = [
  { company: "Stripe", industry: "Fintech / Payments", region: "United States" },
  { company: "NVIDIA", industry: "Semiconductors", region: "United States" },
  { company: "Snowflake", industry: "Cloud Data", region: "United States" },
];
const FEATURES = [
  { title: "Technology Stack", body: "Identify every platform, integration, and the gaps you can sell into.", icon: "M4 17l6-6-6-6M12 19h8", c: "var(--purple)" },
  { title: "Opportunity Map", body: "AI-generated openings mapped to decision-makers and priority.", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", c: "var(--teal)" },
  { title: "Buyer Personas", body: "Who you'll meet, what drives them, and the objection they'll raise.", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z", c: "var(--green)" },
];
const TITLE = ["Strategic", "Intelligence", "Hub"];

export default function Landing({ onStart, disabled, lockInteractive = false, greetingName = null, allSections = [] }) {
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  // null = all sections; otherwise a Set of selected section numbers.
  const [selected, setSelected] = useState(null);

  const allNums = allSections.map((s) => s.n);
  const isAll = selected === null || selected.size === allNums.length;
  const selectedCount = isAll ? allSections.length : selected.size;

  const toggleSection = (n) => {
    setSelected((prev) => {
      const base = prev === null ? new Set(allNums) : new Set(prev);
      if (base.has(n)) base.delete(n); else base.add(n);
      return base.size === allNums.length ? null : base;
    });
  };
  const selectAll = () => setSelected(null);
  const selectNone = () => setSelected(new Set());

  const canStart = company.trim() && (isAll || selected.size > 0);
  const run = () => {
    if (!canStart || disabled) return;
    const selectedSteps = isAll ? undefined : [...selected].sort((a, b) => a - b);
    onStart({ company: company.trim(), industry: "Unknown", region: location.trim() || "Global", selectedSteps });
  };
  const pick = (t) => setCompany(t.company);

  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-24 pb-24 text-center">

      {/* personalized greeting */}
      {greetingName && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-3 font-mono text-sm" style={{ color: "var(--teal)" }}>
          {greetingName}
        </motion.div>
      )}

      {/* eyebrow */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="mb-5 flex justify-center">
        <span className="eyebrow rounded-full border px-3 py-1" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
          AI Sales Intelligence · Enterprise Tier
        </span>
      </motion.div>

      <motion.h1
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }}
        className="display-hero text-6xl sm:text-8xl" style={{ perspective: 800 }}
      >
        {TITLE.map((w, i) => (
          <motion.span key={i}
            variants={{ hidden: { opacity: 0, y: 36, rotateX: -45 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { type: "spring", stiffness: 280, damping: 22 } } }}
            className="mr-3 inline-block" style={{ transformStyle: "preserve-3d" }}>{w}</motion.span>
        ))}
      </motion.h1>

      <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="text-body mx-auto mt-6 max-w-lg text-[1.05rem] ink-soft">
        Generate a live sales intelligence profile for any company — financials, tech stack, pain points, and a ready-to-use opportunity map.
      </motion.p>

      <div style={lockInteractive ? { filter: "blur(5px)", opacity: 0.5, userSelect: "none" } : undefined}
        aria-hidden={lockInteractive}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 22 }}
        className="mt-10 flex items-center gap-2 rounded-full border p-2 pl-5"
        style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)", backdropFilter: "blur(12px)", boxShadow: "0 0 80px -20px rgba(45,212,191,0.35)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" style={{ color: "var(--teal)" }}>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Enter a company name to generate a profile"
          className="text-body flex-1 bg-transparent text-[0.95rem] outline-none ink placeholder:text-ink-faint" />
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={run} disabled={!canStart || disabled}
          className="font-mono rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
          style={{ background: "var(--teal)", color: "var(--bg)" }}>
          {disabled ? "Working" : "Generate"}
        </motion.button>
      </motion.div>

      {/* Optional location — helps disambiguate companies with common names */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        className="mx-auto mt-3 flex max-w-md items-center gap-2 rounded-full border px-4 py-2"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 ink-faint">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <input value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Location (optional) — e.g. Pune, India"
          className="flex-1 bg-transparent text-sm outline-none ink placeholder:text-ink-faint" />
        {location && (
          <button onClick={() => setLocation("")} className="text-xs ink-faint hover:text-teal" title="Clear location">✕</button>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="ink-faint">Trending:</span>
        {TRENDING.map((t) => (
          <button key={t.company} onClick={() => pick(t)}
            className="font-mono rounded-md border px-2.5 py-1 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal">
            {t.company}
          </button>
        ))}
      </motion.div>

      {/* ─── Section picker ─── */}
      {allSections.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          className="mx-auto mt-5 max-w-xl">
          <button onClick={() => setShowPicker((v) => !v)}
            className="font-mono mx-auto flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal"
            style={{ borderColor: "var(--border)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showPicker ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
            {isAll ? "All 13 sections" : `${selectedCount} section${selectedCount === 1 ? "" : "s"} selected`}
          </button>

          {showPicker && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="mt-3 overflow-hidden rounded-2xl border p-4 text-left"
              style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 70%, transparent)" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="eyebrow">Choose sections to generate</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="font-mono text-[11px] uppercase tracking-wide hover:text-teal" style={{ color: isAll ? "var(--teal)" : "var(--ink-faint)" }}>All</button>
                  <span className="ink-faint">·</span>
                  <button onClick={selectNone} className="font-mono text-[11px] uppercase tracking-wide hover:text-teal ink-faint">None</button>
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {allSections.map((s) => {
                  const on = isAll || selected.has(s.n);
                  return (
                    <button key={s.n} onClick={() => toggleSection(s.n)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-[var(--surface-2)]">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                        style={{ borderColor: on ? "var(--teal)" : "var(--border)", background: on ? "var(--teal)" : "transparent" }}>
                        {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                      <span className="ink-soft"><span className="font-mono text-xs ink-faint">{String(s.n).padStart(2, "0")}</span> {s.title}</span>
                    </button>
                  );
                })}
              </div>
              {!isAll && selected.size === 0 && (
                <p className="mt-3 text-center text-xs" style={{ color: "var(--red)" }}>Select at least one section.</p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        className="mt-20 grid gap-4 sm:grid-cols-3 text-left">
        {FEATURES.map((f) => (
          <motion.div key={f.title}
            variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } } }}
            whileHover={{ y: -6 }} className="card card-glow p-6"
            style={{ background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(8px)" }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--surface-2)", color: f.c }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
            </span>
            <h3 className="font-display mt-4 text-lg font-bold ink">{f.title}</h3>
            <p className="text-body mt-1.5 text-sm ink-soft">{f.body}</p>
          </motion.div>
        ))}
      </motion.div>
      </div>
    </div>
  );
}