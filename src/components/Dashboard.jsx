import { motion } from "framer-motion";
import { ProgressBar, PercentRow, Gauge, Pill, Donut, BarChart, SeverityBar } from "./charts.jsx";
import WorldMap from "./WorldMap.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { generatePDF } from "../lib/generatePDF.js";

// ── helpers ──
const reveal = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

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

export default function Dashboard({ blocks, company, onReset }) {
  const hero = find(blocks, "HERO");
  const metrics = find(blocks, "METRICS");
  const cardGrids = findAll(blocks, "CARD_GRID"); // [business, operations, tech]
  const [business, operations, tech] = cardGrids;
  const pains = find(blocks, "PAIN_POINTS");
  const table = find(blocks, "TABLE");
  const insights = find(blocks, "INSIGHTS");
  const solutions = find(blocks, "SOLUTIONS");
  const personas = find(blocks, "PERSONAS");
  const roadmap = find(blocks, "ROADMAP");

  return (
    <div className="relative mx-auto max-w-6xl space-y-20 px-4 py-10 sm:px-6">
      {/* ─── OVERVIEW / HERO ─── */}
      {hero && (
        <motion.section variants={reveal} initial="hidden" animate="show">
          <div className="flex flex-wrap items-center gap-2">
            <Pill color="var(--cyan)" soft="var(--surface-2)">{hero.industry}</Pill>
            <Pill color="var(--teal)" soft="var(--surface-2)">{hero.region}</Pill>
            <Pill color="var(--green)" soft="var(--green-soft)">● {hero.growth_stage}</Pill>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <CompanyLogo name={company || hero.company_name} size={72} />
            <h1 className="font-display text-5xl font-bold ink sm:text-6xl">{hero.company_name}</h1>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => { generatePDF(blocks, company || hero.company_name).catch((e) => console.error("PDF generation failed:", e)); }}
              className="font-mono ml-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--teal)", color: "var(--bg)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download Report
            </motion.button>
          </div>
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed ink-soft">{hero.key_insight}</p>

          {/* Metric cards */}
          {metrics?.items && (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.items.slice(0, 4).map((m, i) => (
                <motion.div key={i} variants={reveal} whileHover={{ y: -4 }}
                  className="card card-glow p-5">
                  <div className="eyebrow">{m.label}</div>
                  <div className="font-display mt-2 text-2xl font-bold ink">{m.value}</div>
                  <div className="mt-1 text-xs" style={{ color: m.signal === "positive" ? "var(--green)" : m.signal === "negative" ? "var(--red)" : "var(--ink-faint)" }}>
                    {m.signal === "positive" ? "▲" : m.signal === "negative" ? "▼" : "—"} signal
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Summary + sales angle + world map */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="card p-6 lg:col-span-2">
              <div className="eyebrow" style={{ color: "var(--teal)" }}>Strategic Summary</div>
              <p className="mt-3 text-sm leading-relaxed ink-soft">{hero.key_insight}</p>
              <div className="mt-4 rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                <div className="eyebrow" style={{ color: "var(--green)" }}>Sales Angle</div>
                <p className="mt-2 text-sm ink">{hero.sales_angle}</p>
              </div>
            </div>
            <div className="card overflow-hidden p-1">
              <WorldMap locations={hero.key_locations} />
            </div>
          </div>
        </motion.section>
      )}

      {/* ─── BUSINESS MODEL ─── */}
      {business?.cards && (
        <Section eyebrow="01 · Business Model" title="Revenue & Market Position" accent="var(--teal)">
          {(() => {
            // If any card has percentage bullets (e.g. revenue streams), show a donut.
            const pctCard = business.cards.find((c) => extractPercents(c.bullets).length >= 2);
            const segs = pctCard ? extractPercents(pctCard.bullets) : null;
            return segs ? (
              <div className="card mb-4 p-5">
                <div className="eyebrow mb-3" style={{ color: "var(--teal)" }}>{pctCard.title}</div>
                <Donut segments={segs} />
              </div>
            ) : null;
          })()}
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid gap-4 sm:grid-cols-2">
            {business.cards.map((c, i) => (
              <motion.div key={i} variants={reveal} whileHover={{ y: -4 }}
                className={`card card-glow p-5 ${i % 2 ? "card-accent-purple" : "card-accent-teal"}`}>
                <div className="eyebrow" style={{ color: i % 2 ? "var(--purple)" : "var(--teal)" }}>{c.title}</div>
                <ul className="mt-3 space-y-2">
                  {(c.bullets || []).map((b, j) => (
                    <li key={j} className="flex gap-2 text-sm ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: i % 2 ? "var(--purple)" : "var(--teal)" }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      )}

      {/* ─── OPERATIONS ─── */}
      {operations?.cards && (
        <Section eyebrow="02 · Operations" title="Operations & Distribution" accent="var(--cyan)">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {operations.cards.map((c, i) => (
              <motion.div key={i} variants={reveal} whileHover={{ y: -4 }} className="card card-glow p-5">
                <span className="glow-dot inline-block h-2 w-2 rounded-full" style={{ color: "var(--cyan)", background: "var(--cyan)" }} />
                <div className="eyebrow mt-3">{c.title}</div>
                <ul className="mt-2 space-y-1.5">
                  {(c.bullets || []).map((b, j) => (
                    <li key={j} className="text-xs ink-soft">{b}</li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      )}

      {/* ─── TECH STACK ─── */}
      {tech?.cards && (
        <Section eyebrow="03 · Technology" title="Technology Stack" accent="var(--purple)">
          <div className="grid gap-4 sm:grid-cols-2">
            {tech.cards.map((c, i) => {
              const isMaturity = /maturity|level/i.test(c.title);
              return (
                <motion.div key={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}
                  className="card card-glow p-5">
                  <div className="eyebrow" style={{ color: i % 2 ? "var(--purple)" : "var(--teal)" }}>{c.title}</div>
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
                        <li key={j} className="flex items-center justify-between gap-2 text-sm ink-soft">
                          <span className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--teal)" }} />{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ─── OPPORTUNITY: pains + table ─── */}
      {(pains?.points || table?.rows) && (
        <Section eyebrow="04 · Opportunity" title="Opportunity Map & Strategy" accent="var(--cyan)">
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
                    <motion.div key={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}
                      className="card card-glow flex items-center justify-between p-4">
                      <div>
                        <div className="text-sm font-semibold ink">{p.title}</div>
                        <div className="eyebrow mt-1">{p.description?.slice(0, 40)}</div>
                      </div>
                      <Pill color={sev[0]} soft={sev[1]}>{sev[2]}</Pill>
                    </motion.div>
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
                    <motion.div key={i} variants={reveal} whileHover={{ y: -4 }} className="card card-glow p-5">
                      <h3 className="font-display text-lg font-bold ink">{s.name}</h3>
                      <p className="mt-2 text-sm ink-soft">{s.problem_solved}</p>
                      <div className="mt-4 rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
                        <div className="eyebrow" style={{ color: "var(--green)" }}>Business Impact</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          {impact && <span className="font-display text-2xl font-bold" style={{ color: "var(--green)" }}>{impact[1]}</span>}
                          <span className="text-sm ink-soft">{s.impact?.replace(impact?.[1] || "", "").slice(0, 24)}</span>
                        </div>
                      </div>
                    </motion.div>
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
                <span className="font-mono text-xs font-bold" style={{ color: "var(--teal)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm ink-soft">{ins}</span>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      )}

      {/* ─── PERSONAS ─── */}
      {personas?.personas && (
        <Section eyebrow="06 · Stakeholders" title="Buyer Personas" accent="var(--purple)">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {personas.personas.map((p, i) => (
              <motion.div key={i} variants={reveal} whileHover={{ y: -5 }} className="card card-glow p-5">
                <h3 className="font-display font-bold ink">{p.role}</h3>
                <div className="mt-3 space-y-2">
                  <div><div className="eyebrow" style={{ color: "var(--teal)" }}>Focus</div><p className="text-xs ink-soft">{p.focus}</p></div>
                  <div><div className="eyebrow" style={{ color: "var(--purple)" }}>Motivation</div><p className="text-xs ink-soft">{p.motivation}</p></div>
                </div>
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--red)", background: "var(--red-soft)" }}>
                  <div className="eyebrow" style={{ color: "var(--red)" }}>Likely Objection</div>
                  <p className="mt-1 text-xs italic ink">"{p.objection}"</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      )}

      {/* ─── ROADMAP ─── */}
      {roadmap?.phases && (
        <Section eyebrow="07 · Execution" title="Sales Strategy Roadmap" accent="var(--green)">
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
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* footer */}
      <div className="flex items-center justify-between border-t pt-6 text-xs ink-faint">
        <span>Intelligence profile · {company}</span>
        <button onClick={onReset} className="font-mono uppercase tracking-wide hover:text-teal" style={{ color: "var(--teal)" }}>+ New Analysis</button>
      </div>
    </div>
  );
}
