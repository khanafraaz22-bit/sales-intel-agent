import { motion } from "framer-motion";
import { useState } from "react";
import { ProgressBar, PercentRow, Gauge, Pill, Donut, BarChart, SeverityBar } from "./charts.jsx";
import WorldMap from "./WorldMap.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { generatePDF } from "../lib/generatePDF.js";
import { CardModal, ExpandableCard } from "./CardModal.jsx";

// ── helpers ──
const reveal = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

// Report-level provenance badge. HONEST signal: "Web-grounded" means a Brave
// search brief was fetched and fed into generation; "Model knowledge" means the
// report was built from the model's own knowledge (no live web grounding).
// Not a confidence score.
function GroundingBadge({ grounded }) {
  const [hover, setHover] = useState(false);
  const color = grounded ? "var(--teal)" : "#d97706";
  const label = grounded ? "Web-grounded" : "Model knowledge";
  const tip = grounded
    ? "This report was grounded in live web search results (Brave), not just the model's memory."
    : "No live web grounding was available, so this reflects the model's general knowledge. Verify key facts before acting on them.";
  return (
    <span className="relative inline-flex" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {grounded
            ? <><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" /></>
            : <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>}
        </svg>
        {label}
      </span>
      {hover && (
        <span className="absolute left-0 top-full z-20 mt-1.5 w-60 rounded-lg border p-2.5 text-[11px] leading-snug shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink-soft)" }}>
          {tip}
        </span>
      )}
    </span>
  );
}

function Section({ id, eyebrow, title, accent, children }) {
  return (
    <motion.section
      id={id}
      variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }}
      className="scroll-mt-24"
    >
      <div className="mb-5">
        {eyebrow && <div className="eyebrow mb-1" style={{ color: accent }}>{eyebrow}</div>}
        <h2 className="text-2xl font-bold ink">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

const find = (blocks, type) => blocks.find((b) => b.blockType === type)?.blockData;
const findAll = (blocks, type) => blocks.filter((b) => b.blockType === type).map((b) => b.blockData);

// Pull "Label 42%" style entries from a bullets array into {label, value} for charts.
function extractPercents(bullets = []) {
  const palette = ["var(--teal)", "var(--purple)", "var(--cyan)", "var(--green)", "var(--amber)"];
  const out = [];
  bullets.forEach((b, i) => {
    const m = String(b).match(/^(.*?)[\s:—-]*(\d{1,3})\s*%/);
    if (m) out.push({ label: m[1].trim().replace(/[:—-]\s*$/, ""), value: parseInt(m[2], 10), color: palette[i % palette.length] });
  });
  return out;
}

export default function Dashboard({
  blocks, company, onReset, grounded = false,
  // Live-build props (optional — when present, the report shows progress + a
  // bottom control bar so it can be generated section-by-section in place):
  building = false,        // true while the run isn't finished
  running = false,         // true while a section is actively generating
  doneCount = 0,
  usableCount = 0,
  totalSteps = 11,
  nextStepName = null,
  error = null,
  lastFailed = false,
  onNext = null,           // generate the next section
}) {
  // Click-to-expand modal state. `modal` holds { title, section, kind, data }.
  const [modal, setModal] = useState(null);
  const openModal = (payload) => setModal(payload);
  const closeModal = () => setModal(null);

  // Jump-to-section dropdown state.
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpTo = (id) => {
    setJumpOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hero = find(blocks, "HERO");
  const metrics = find(blocks, "METRICS");
  const metricsTitle = blocks.find((b) => b.blockType === "METRICS")?.stepTitle || "Financial Signals";
  // All CARD_GRID sections, paired with their section titles, rendered
  // uniformly below. (Retail report has 8; this handles any number.)
  const cardSections = blocks
    .filter((b) => b.blockType === "CARD_GRID" && b.blockData)
    .map((b) => ({ title: b.stepTitle || "Details", data: b.blockData }));
  const pains = find(blocks, "PAIN_POINTS");
  const painsTitle = blocks.find((b) => b.blockType === "PAIN_POINTS")?.stepTitle || "Pain Point Analysis";
  const table = find(blocks, "TABLE");
  const insights = find(blocks, "INSIGHTS");
  const solutions = find(blocks, "SOLUTIONS");
  const personas = find(blocks, "PERSONAS");
  const personasTitle = blocks.find((b) => b.blockType === "PERSONAS")?.stepTitle || "Buyer Personas";
  const decisionMakers = find(blocks, "DECISION_MAKERS");
  const decisionMakersTitle = blocks.find((b) => b.blockType === "DECISION_MAKERS")?.stepTitle || "Decision-Maker Intelligence";
  const roadmap = find(blocks, "ROADMAP");
  const roadmapTitle = blocks.find((b) => b.blockType === "ROADMAP")?.stepTitle || "Sales Strategy Roadmap";

  // A report is empty if NO block produced usable data (e.g. only failed-parse
  // placeholders, which have blockData: null). Without this guard the page
  // would render just a footer and look broken.
  const hasAnyData = [hero, metrics, ...cardSections.map((s) => s.data), pains, table, insights, solutions, personas, decisionMakers, roadmap]
    .some((d) => d != null);

  if (!hasAnyData) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--surface-2)", color: "var(--amber)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold ink">No sections generated yet</h1>
        <p className="text-body mt-2 max-w-sm text-sm ink-soft">
          {company ? <>The analysis for <span className="ink">{company}</span> didn't produce any usable sections.</> : "This report has no usable sections."}{" "}
          This usually means the section failed to generate cleanly. Start a new analysis and try again.
        </p>
        <button onClick={onReset}
          className="font-mono mt-6 rounded-lg px-6 py-3 text-xs font-semibold uppercase tracking-wide"
          style={{ background: "var(--teal)", color: "var(--bg)" }}>
          + New Analysis
        </button>
      </div>
    );
  }

  // If HERO failed but other sections exist, synthesize a minimal header so the
  // report still has a title block instead of starting mid-page.
  const heroFallback = hero || {
    company_name: company || "Company",
    industry: null, region: null, growth_stage: null,
    key_insight: null, sales_angle: null, key_locations: [],
  };

  // Ordered list of sections that actually rendered, for the jump menu.
  const jumpItems = [];
  if (hero) jumpItems.push({ id: "sec-1", n: 1, title: blocks.find((b) => b.blockType === "HERO")?.stepTitle || "Executive Summary" });
  if (metrics?.items) jumpItems.push({ id: "sec-2", n: 2, title: metricsTitle });
  cardSections.forEach((sec, si) => jumpItems.push({ id: `sec-${si + 3}`, n: si + 3, title: sec.title }));
  if (decisionMakers) jumpItems.push({ id: "sec-11", n: 11, title: decisionMakersTitle });
  if (personas?.personas) jumpItems.push({ id: "sec-11b", n: 11, title: personasTitle });
  if (pains?.points || table?.rows) jumpItems.push({ id: "sec-12", n: 12, title: painsTitle });
  if (roadmap?.phases) jumpItems.push({ id: "sec-13", n: 13, title: roadmapTitle });

  return (
    <div className="relative mx-auto max-w-6xl space-y-20 px-4 py-10 sm:px-6">
      {/* ─── Jump-to-section menu (floating) ─── */}
      {jumpItems.length > 1 && (
        <div className="fixed bottom-6 right-6 z-40 !mt-0">
          {jumpOpen && (
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-14 right-0 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border p-2 shadow-xl"
              style={{ borderColor: "var(--border)", background: "var(--surface)", backdropFilter: "blur(12px)" }}>
              <div className="eyebrow px-2 py-1.5">Jump to section</div>
              {jumpItems.map((it) => (
                <button key={it.id} onClick={() => jumpTo(it.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ink-soft transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">
                  <span className="font-mono text-xs ink-faint">{String(it.n).padStart(2, "0")}</span>
                  <span className="truncate">{it.title}</span>
                </button>
              ))}
            </motion.div>
          )}
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setJumpOpen((v) => !v)}
            className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
            style={{ background: "var(--teal)", color: "var(--bg)" }}
            title="Jump to section">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {jumpOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </motion.button>
        </div>
      )}
      {/* ─── LIVE-BUILD PROGRESS (top) ─── */}
      {building && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="!mt-0 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border px-4 py-1.5"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(8px)" }}>
            {running ? (
              <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
                className="h-2 w-2 rounded-full" style={{ background: "var(--teal)" }} />
            ) : (
              <span className="h-2 w-2 rounded-full" style={{ background: error ? "var(--red)" : "var(--teal)" }} />
            )}
            <span className="font-mono text-xs ink-soft">
              {running ? `Generating ${nextStepName || "section"}…` : `${usableCount} of ${totalSteps} sections`}
            </span>
            {/* mini progress track */}
            <span className="ml-1 h-1 w-20 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <motion.span className="block h-full rounded-full" style={{ background: "var(--teal)" }}
                animate={{ width: `${Math.round((usableCount / totalSteps) * 100)}%` }} transition={{ duration: 0.5 }} />
            </span>
          </div>
        </motion.div>
      )}

      {/* ─── OVERVIEW / HERO ─── */}
      {(
        <motion.section id="sec-1" variants={reveal} initial="hidden" animate="show">
          <div className="flex flex-wrap items-center gap-2">
            {heroFallback.industry && <Pill color="var(--cyan)" soft="var(--surface-2)">{heroFallback.industry}</Pill>}
            {heroFallback.region && <Pill color="var(--teal)" soft="var(--surface-2)">{heroFallback.region}</Pill>}
            {heroFallback.growth_stage && <Pill color="var(--green)" soft="var(--green-soft)">● {heroFallback.growth_stage}</Pill>}
            <GroundingBadge grounded={grounded} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <CompanyLogo name={company || heroFallback.company_name} size={72} />
            <h1 className="font-display text-5xl font-bold ink sm:text-6xl">{heroFallback.company_name}</h1>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => { generatePDF(blocks, company || heroFallback.company_name).catch((e) => console.error("PDF generation failed:", e)); }}
              className="font-mono ml-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--teal)", color: "var(--bg)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download Report
            </motion.button>
          </div>
          {heroFallback.key_insight && <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed ink-soft">{heroFallback.key_insight}</p>}

          {/* Summary + sales angle + world map — only when HERO actually produced content */}
          {(heroFallback.key_insight || heroFallback.sales_angle || (heroFallback.key_locations || []).length > 0) && (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="card p-6 lg:col-span-2">
                <div className="eyebrow" style={{ color: "var(--teal)" }}>Strategic Summary</div>
                {heroFallback.key_insight && <p className="mt-3 text-sm leading-relaxed ink-soft">{heroFallback.key_insight}</p>}
                {heroFallback.sales_angle && (
                  <div className="mt-4 rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                    <div className="eyebrow" style={{ color: "var(--green)" }}>Sales Angle</div>
                    <p className="mt-2 text-sm ink">{heroFallback.sales_angle}</p>
                  </div>
                )}
              </div>
              {(heroFallback.key_locations || []).length > 0 && (
                <div className="card overflow-hidden p-1">
                  <WorldMap locations={heroFallback.key_locations} />
                </div>
              )}
            </div>
          )}
        </motion.section>
      )}

      {/* ─── FINANCIAL HEALTH / METRICS ─── */}
      {metrics?.items && (
        <Section id="sec-2" eyebrow={`02 · ${metricsTitle}`} title={metricsTitle} accent="var(--green)">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.items.map((m, i) => {
              const sigColor = m.signal === "positive" ? "var(--green)" : m.signal === "negative" ? "var(--red)" : "var(--ink-faint)";
              const orbClass = ["card-orb", "card-orb card-orb-purple", "card-orb card-orb-green", "card-orb"][i % 4];
              return (
                <motion.div key={i} variants={reveal} whileHover={{ y: -4 }}
                  className={`card card-glow ${orbClass} p-5`}>
                  <div className="flex items-start justify-between">
                    <div className="eyebrow">{m.label}</div>
                    <span className="orb-badge h-7 w-7 text-[11px]"
                      style={{ background: `color-mix(in srgb, ${sigColor} 16%, transparent)`, color: sigColor }}>
                      {m.signal === "positive" ? "▲" : m.signal === "negative" ? "▼" : "—"}
                    </span>
                  </div>
                  <div className="font-display mt-2 text-2xl font-bold ink">{m.value}</div>
                  <div className="mt-1 text-xs" style={{ color: sigColor }}>{m.signal} signal</div>
                </motion.div>
              );
            })}
          </motion.div>
        </Section>
      )}

      {/* ─── CARD-GRID SECTIONS (uniform; retail report has 8) ─── */}
      {cardSections.map((sec, si) => {
        const accents = ["var(--teal)", "var(--purple)", "var(--cyan)", "var(--green)"];
        const accent = accents[si % accents.length];
        const orbVariants = ["", "card-orb-purple", "", "card-orb-green"];
        // If any card has percentage bullets (e.g. revenue mix), show a donut.
        const pctCard = (sec.data.cards || []).find((c) => extractPercents(c.bullets).length >= 2);
        const segs = pctCard ? extractPercents(pctCard.bullets) : null;
        return (
          <Section key={si} id={`sec-${si + 3}`} eyebrow={`${String(si + 3).padStart(2, "0")} · ${sec.title}`} title={sec.title} accent={accent}>
            {segs && (
              <div className="card mb-4 p-5">
                <div className="eyebrow mb-3" style={{ color: accent }}>{pctCard.title}</div>
                <Donut segments={segs} />
              </div>
            )}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2">
              {(sec.data.cards || []).map((c, i) => {
                const isMaturity = /maturity|level/i.test(c.title || "");
                const cardAccent = i % 2 ? "var(--purple)" : accent;
                return (
                  <ExpandableCard key={i} onExpand={() => openModal({ title: c.title, section: sec.title, kind: "bullets", data: c })}>
                    <motion.div variants={reveal} whileHover={{ y: -4 }}
                      className={`card card-glow card-orb ${i % 2 ? "card-orb-purple" : si % 4 === 3 ? "card-orb-green" : ""} p-5`}>
                      <div className="eyebrow" style={{ color: cardAccent }}>{c.title}</div>
                      {isMaturity ? (
                        <div className="mt-4 space-y-3">
                          {(c.bullets || []).map((b, j) => (
                            <ProgressBar key={j} label={b} level={["Advanced", "Emerging", "Leading"][j % 3]}
                              color={["var(--green)", "var(--teal)", "var(--purple)"][j % 3]} />
                          ))}
                        </div>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {(c.bullets || []).map((b, j) => (
                            <li key={j} className="flex gap-2 text-sm ink-soft">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: cardAccent }} />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  </ExpandableCard>
                );
              })}
            </motion.div>
          </Section>
        );
      })}

      {/* ─── DECISION-MAKERS (real LinkedIn profiles) ─── */}
      {decisionMakers && (
        <Section id="sec-11" eyebrow={`11 · ${decisionMakersTitle}`} title={decisionMakersTitle} accent="var(--purple)">
          {(decisionMakers.people || []).length > 0 ? (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {decisionMakers.people.map((p, i) => {
                const initials = (p.name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                const aColor = ["var(--teal)", "var(--purple)", "var(--cyan)", "var(--green)"][i % 4];
                return (
                  <motion.a key={i} variants={reveal} whileHover={{ y: -4 }}
                    href={p.url} target="_blank" rel="noreferrer"
                    className="card card-glow card-orb block p-5"
                    title="Open LinkedIn profile">
                    <div className="flex items-center gap-3">
                      <span className="orb-badge h-12 w-12 text-sm"
                        style={{ background: `color-mix(in srgb, ${aColor} 18%, transparent)`, color: aColor }}>
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display truncate font-bold leading-tight ink">{p.name}</h3>
                        {p.title && <p className="truncate text-xs ink-soft">{p.title}</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-xs" style={{ color: "var(--teal)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" /></svg>
                      View LinkedIn profile
                    </div>
                  </motion.a>
                );
              })}
            </motion.div>
          ) : (
            <div className="card p-6 text-center text-sm ink-soft">
              No public LinkedIn profiles were found for this company's decision-makers.
              {" "}This is common for smaller or privately-held companies whose leadership isn't publicly indexed.
            </div>
          )}
        </Section>
      )}

      {/* ─── PERSONAS ─── */}
      {personas?.personas && (
        <Section id="sec-11b" eyebrow={`11 · ${personasTitle}`} title={personasTitle} accent="var(--purple)">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {personas.personas.map((p, i) => {
              const initials = (p.role || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
              const aColor = ["var(--teal)", "var(--purple)", "var(--cyan)", "var(--green)"][i % 4];
              return (
                <ExpandableCard key={i} onExpand={() => openModal({ title: p.role, section: "Buyer Personas", kind: "persona", data: p })}>
                  <motion.div variants={reveal} whileHover={{ y: -5 }} className="card card-glow card-orb p-5">
                    <div className="flex items-center gap-3">
                      <span className="orb-badge h-11 w-11 text-sm"
                        style={{ background: `color-mix(in srgb, ${aColor} 18%, transparent)`, color: aColor }}>
                        {initials}
                      </span>
                      <h3 className="font-display font-bold leading-tight ink">{p.role}</h3>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div><div className="eyebrow" style={{ color: "var(--teal)" }}>Focus</div><p className="text-xs ink-soft">{p.focus}</p></div>
                      <div><div className="eyebrow" style={{ color: "var(--purple)" }}>Motivation</div><p className="text-xs ink-soft">{p.motivation}</p></div>
                    </div>
                    <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--red)", background: "var(--red-soft)" }}>
                      <div className="eyebrow" style={{ color: "var(--red)" }}>Likely Objection</div>
                      <p className="mt-1 text-xs italic ink">"{p.objection}"</p>
                    </div>
                  </motion.div>
                </ExpandableCard>
              );
            })}
          </motion.div>
        </Section>
      )}

      {/* ─── OPPORTUNITY: pains + table ─── */}
      {(pains?.points || table?.rows) && (
        <Section id="sec-12" eyebrow={`12 · ${painsTitle}`} title={painsTitle} accent="var(--red)">
          <div className="grid gap-4 lg:grid-cols-5">
            {/* pains */}
            {pains?.points && (
              <div className="space-y-3 lg:col-span-2">
                <div className="eyebrow">Pain Point Analysis</div>
                <div className="card p-4">
                  <SeverityBar
                    high={pains.points.filter((p) => p.severity === "high").length}
                    medium={pains.points.filter((p) => p.severity === "medium").length}
                    low={pains.points.filter((p) => p.severity === "low").length}
                  />
                </div>
                {pains.points.map((p, i) => {
                  const sev = p.severity === "high" ? ["var(--red)", "var(--red-soft)", "HIGH RISK"] : p.severity === "medium" ? ["var(--purple)", "var(--purple-soft)", "MED RISK"] : ["var(--ink-faint)", "var(--surface-2)", "LOW RISK"];
                  return (
                    <ExpandableCard key={i} onExpand={() => openModal({ title: p.title, section: "Pain Point Analysis", kind: "pain", data: p })}>
                      <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}
                        className="card card-glow flex items-center justify-between p-4">
                        <div>
                          <div className="text-sm font-semibold ink">{p.title}</div>
                          <div className="eyebrow mt-1">{p.description?.slice(0, 40)}</div>
                        </div>
                        <Pill color={sev[0]} soft={sev[1]}>{sev[2]}</Pill>
                      </motion.div>
                    </ExpandableCard>
                  );
                })}
              </div>
            )}
            {/* table */}
            {table?.rows && (
              <div className="card overflow-hidden lg:col-span-3">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>{(table.columns || []).map((c, i) => <th key={i} className="eyebrow px-4 py-3" style={{ color: "var(--teal)" }}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, i) => (
                      <motion.tr key={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}
                        className="border-t">
                        {(row.cells || []).map((cell, j) => (
                          <td key={j} className="px-4 py-3 ink-soft">
                            {j === 3 ? <Pill color="var(--green)" soft="var(--green-soft)">{cell}</Pill> : cell}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* solutions */}
          {solutions?.solutions && (
            <div className="mt-8">
              <div className="eyebrow mb-3">Recommended Solution Stack</div>
              <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="grid gap-4 md:grid-cols-3">
                {solutions.solutions.slice(0, 3).map((s, i) => {
                  const impact = (s.impact || "").match(/(\d+%?)/);
                  return (
                    <ExpandableCard key={i} onExpand={() => openModal({ title: s.name, section: "Recommended Solution Stack", kind: "solution", data: s })}>
                      <motion.div variants={reveal} whileHover={{ y: -4 }} className="card card-glow card-orb-green card-orb p-5">
                        <h3 className="font-display text-lg font-bold ink">{s.name}</h3>
                        <p className="mt-2 text-sm ink-soft">{s.problem_solved}</p>
                        <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--surface-2)" }}>
                          <div className="eyebrow" style={{ color: "var(--green)" }}>Business Impact</div>
                          <div className="mt-1 flex items-baseline gap-2">
                            {impact && <span className="font-display text-2xl font-bold" style={{ color: "var(--green)" }}>{impact[1]}</span>}
                            <span className="text-sm ink-soft">{s.impact?.replace(impact?.[1] || "", "").slice(0, 24)}</span>
                          </div>
                        </div>
                      </motion.div>
                    </ExpandableCard>
                  );
                })}
              </motion.div>
            </div>
          )}
        </Section>
      )}

      {/* ─── INSIGHTS ─── */}
      {insights?.insights && (
        <Section eyebrow="05 · Intelligence" title="AI Analyst Insights" accent="var(--teal)">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid gap-3 sm:grid-cols-2">
            {insights.insights.map((ins, i) => (
              <motion.div key={i} variants={reveal} className="card card-glow flex gap-3 p-4">
                <span className="orb-badge h-7 w-7 font-mono text-xs"
                  style={{ background: "color-mix(in srgb, var(--teal) 14%, transparent)", color: "var(--teal)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm ink-soft">{ins}</span>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      )}

      {/* ─── ROADMAP ─── */}
      {roadmap?.phases && (
        <Section id="sec-13" eyebrow={`13 · ${roadmapTitle}`} title={roadmapTitle} accent="var(--green)">
          <div className="relative grid gap-4 md:grid-cols-3">
            {/* connecting line */}
            <div className="absolute left-0 right-0 top-5 hidden h-px md:block" style={{ background: "linear-gradient(90deg, var(--teal), var(--purple), var(--green))" }} />
            {roadmap.phases.slice(0, 3).map((phase, i) => {
              const c = ["var(--teal)", "var(--purple)", "var(--green)"][i];
              return (
                <motion.div key={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }} className="relative">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full font-mono text-sm font-bold"
                    style={{ background: "var(--bg)", border: `2px solid ${c}`, color: c }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <ExpandableCard onExpand={() => openModal({ title: phase.phase, section: "Sales Strategy Roadmap", kind: "phase", data: phase })}>
                    <div className="card card-glow mt-4 p-5" style={{ boxShadow: `inset 3px 0 0 ${c}` }}>
                      <h3 className="font-display font-bold" style={{ color: c }}>{phase.phase}</h3>
                      <ul className="mt-3 space-y-2">
                        {(phase.actions || []).map((a, j) => (
                          <li key={j} className="flex gap-2 text-xs ink-soft">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: c }} />{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ExpandableCard>
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ─── LIVE-BUILD CONTROLS (bottom) ─── */}
      {building && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4">
          {error && (
            <div className="w-full max-w-lg rounded-lg p-4 text-center text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              {error}
            </div>
          )}
          {!error && lastFailed && (
            <div className="w-full max-w-lg rounded-lg p-4 text-center text-sm" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
              The last section didn't generate cleanly. Click Generate to retry it.
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale: running ? 1 : 1.04 }} whileTap={{ scale: running ? 1 : 0.96 }}
              onClick={onNext} disabled={running || !onNext}
              className="font-mono rounded-lg px-8 py-3.5 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "var(--teal)", color: "var(--bg)" }}>
              {running
                ? "Working…"
                : (error || lastFailed)
                ? `Retry ${nextStepName || "section"}`
                : `Generate next section${nextStepName ? ` · ${nextStepName}` : ""}`}
            </motion.button>
            {usableCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => { generatePDF(blocks, company || heroFallback.company_name).catch((e) => console.error("PDF generation failed:", e)); }}
                className="font-mono flex items-center gap-2 rounded-lg border px-6 py-3.5 text-sm font-semibold uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal"
                style={{ borderColor: "var(--border)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download ({usableCount}/{totalSteps})
              </motion.button>
            )}
          </div>
        </motion.div>
      )}

      {/* Expandable card modal */}
      {modal && (
        <CardModal
          open={Boolean(modal)}
          onClose={closeModal}
          title={modal.title}
          company={company || heroFallback.company_name}
          section={modal.section}
          kind={modal.kind}
          data={modal.data}
        />
      )}

      {/* footer */}
      <div className="flex items-center justify-between border-t pt-6 text-xs ink-faint">
        <span>Intelligence profile · {company}</span>
        <button onClick={onReset} className="font-mono uppercase tracking-wide hover:text-teal" style={{ color: "var(--teal)" }}>+ New Analysis</button>
      </div>
    </div>
  );
}
