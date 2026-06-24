import { jsPDF } from "jspdf";

// Builds a polished, multi-page PDF report from the analysis blocks.
// Hand-laid-out (real selectable text, not screenshots) for a crisp result.

const TEAL = [13, 148, 136];
const PURPLE = [124, 58, 237];
const GREEN = [5, 150, 105];
const RED = [220, 38, 38];
const INK = [17, 24, 33];
const SOFT = [90, 100, 115];
const FAINT = [140, 150, 165];
const LINE = [225, 231, 239];

const find = (blocks, type) => blocks.find((b) => b.blockType === type)?.blockData;
const findAll = (blocks, type) => blocks.filter((b) => b.blockType === type).map((b) => b.blockData);

// Guess a domain from the company name (same logic as the UI logo component).
function guessDomain(name) {
  if (!name) return null;
  const cleaned = name.toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|plc|co|group|technologies|technology|holdings|the|company|limited)\b/g, "")
    .replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  return cleaned ? `${cleaned}.com` : null;
}

// Fetch the company logo and return a PNG data URL, or null on failure.
// Uses Google's favicon service (keyless). Drawn onto a canvas to normalize to PNG.
async function fetchLogoDataURL(company) {
  const domain = guessDomain(company);
  if (!domain) return null;
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    if (!img.width) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, 128, 128);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function initials(name) {
  if (!name) return "?";
  const words = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export async function generatePDF(blocks, company) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48; // margin
  let y = M;
  let page = 1;

  const hero = find(blocks, "HERO");
  const metrics = find(blocks, "METRICS");
  const [business, operations, tech] = findAll(blocks, "CARD_GRID");
  const pains = find(blocks, "PAIN_POINTS");
  const table = find(blocks, "TABLE");
  const insights = find(blocks, "INSIGHTS");
  const solutions = find(blocks, "SOLUTIONS");
  const personas = find(blocks, "PERSONAS");
  const roadmap = find(blocks, "ROADMAP");

  // ── helpers ──
  const footer = () => {
    doc.setFontSize(8); doc.setTextColor(...FAINT); doc.setFont("helvetica", "normal");
    doc.text(`Sales Intelligence Profile · ${company}`, M, H - 24);
    doc.text(`Page ${page}`, W - M, H - 24, { align: "right" });
  };
  const newPage = () => { footer(); doc.addPage(); page++; y = M; };
  const need = (h) => { if (y + h > H - 50) newPage(); };

  const heading = (num, title, color = TEAL) => {
    need(46); y += 8;
    doc.setFillColor(...color); doc.rect(M, y - 2, 4, 20, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...INK);
    doc.text(`${num}  ${title}`, M + 12, y + 13);
    y += 30;
  };
  const para = (text, opts = {}) => {
    const size = opts.size || 10; const color = opts.color || SOFT;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, opts.width || W - M * 2 - (opts.indent || 0));
    lines.forEach((ln) => { need(size + 4); doc.text(ln, M + (opts.indent || 0), y); y += size + 4; });
  };
  const bullet = (text, color = TEAL) => {
    need(14);
    doc.setFillColor(...color); doc.circle(M + 4, y - 3, 1.5, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...SOFT);
    const lines = doc.splitTextToSize(text, W - M * 2 - 16);
    lines.forEach((ln, i) => { need(14); doc.text(ln, M + 14, y); y += 13; });
    y += 2;
  };
  const gap = (h = 10) => { y += h; };

  // Extract "Label 42%" entries for charts.
  const pcts = (bullets = []) => {
    const pal = [TEAL, PURPLE, [34, 211, 238], GREEN, [180, 130, 30]];
    const out = [];
    bullets.forEach((b, i) => {
      const m = String(b).match(/^(.*?)[\s:—-]*(\d{1,3})\s*%/);
      if (m) out.push({ label: m[1].trim().replace(/[:—-]\s*$/, ""), value: +m[2], color: pal[i % pal.length] });
    });
    return out;
  };

  // Draw a donut chart at (cx,cy) radius rad with a legend to the right.
  const drawDonut = (segs, cx, cy, rad) => {
    const total = segs.reduce((s, x) => s + x.value, 0) || 1;
    let a0 = -Math.PI / 2;
    segs.forEach((s) => {
      const a1 = a0 + (s.value / total) * Math.PI * 2;
      // approximate arc with thick stroked segments
      const steps = Math.max(2, Math.round((a1 - a0) / 0.12));
      doc.setDrawColor(...s.color); doc.setLineWidth(7);
      for (let i = 0; i < steps; i++) {
        const t0 = a0 + ((a1 - a0) * i) / steps;
        const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
        doc.line(cx + rad * Math.cos(t0), cy + rad * Math.sin(t0), cx + rad * Math.cos(t1), cy + rad * Math.sin(t1));
      }
      a0 = a1;
    });
    doc.setLineWidth(0.2);
    // legend
    let ly = cy - rad + 4;
    segs.forEach((s) => {
      doc.setFillColor(...s.color); doc.rect(cx + rad + 16, ly - 6, 7, 7, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...SOFT);
      doc.text(`${s.label}`, cx + rad + 28, ly);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
      doc.text(`${Math.round((s.value / total) * 100)}%`, cx + rad + 150, ly);
      ly += 16;
    });
  };

  // Draw a stacked severity bar.
  const drawSeverity = (high, med, low) => {
    const total = high + med + low || 1;
    const barW = W - M * 2, barH = 8;
    let x = M;
    const segs = [[high, RED], [med, [180, 130, 30]], [low, FAINT]];
    segs.forEach(([n, c]) => {
      const w = (n / total) * barW;
      if (w > 0) { doc.setFillColor(...c); doc.rect(x, y, w, barH, "F"); x += w; }
    });
    y += barH + 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const labels = [["High", high, RED], ["Medium", med, [180, 130, 30]], ["Low", low, FAINT]];
    let lx = M;
    labels.forEach(([lbl, n, c]) => {
      doc.setFillColor(...c); doc.rect(lx, y - 6, 6, 6, "F");
      doc.setTextColor(...SOFT); doc.text(`${lbl} ${n}`, lx + 10, y);
      lx += 70;
    });
    y += 16;
  };

  // ── COVER ──
  const logoData = await fetchLogoDataURL(company);

  // Dark full-bleed background
  doc.setFillColor(8, 11, 18); doc.rect(0, 0, W, H, "F");
  // subtle top accent band
  doc.setFillColor(13, 148, 136); doc.rect(0, 0, W, 6, "F");

  // Brand mark (top-left)
  doc.setFillColor(...TEAL); doc.roundedRect(M, 110, 24, 24, 5, 5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(230, 238, 246);
  doc.text("INTELLIGENCE", M + 34, 122);
  doc.setFontSize(8); doc.setTextColor(...FAINT); doc.text("ENTERPRISE TIER", M + 34, 134);

  // Report label
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(45, 212, 191);
  doc.text("SALES INTELLIGENCE PROFILE", M, 250);

  // Company logo badge
  const badgeY = 270, badgeS = 64;
  doc.setFillColor(20, 24, 34); doc.setDrawColor(40, 48, 62);
  doc.roundedRect(M, badgeY, badgeS, badgeS, 10, 10, "FD");
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M + 12, badgeY + 12, badgeS - 24, badgeS - 24); }
    catch { /* fall through to monogram */ }
  }
  if (!logoData) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(45, 212, 191);
    doc.text(initials(company), M + badgeS / 2, badgeY + badgeS / 2 + 8, { align: "center" });
  }

  // Company name (beside the badge)
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(255, 255, 255);
  const nameLines = doc.splitTextToSize(company, W - M * 2 - badgeS - 20);
  doc.text(nameLines, M + badgeS + 18, badgeY + 28);

  // Meta line under the name area
  let metaY = badgeY + badgeS + 28;
  if (hero) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(150, 161, 180);
    doc.text(
      [hero.industry, hero.region, hero.growth_stage].filter(Boolean).join("   ·   "),
      M, metaY
    );
    metaY += 24;
    doc.setFontSize(10); doc.setTextColor(185, 193, 205);
    doc.text(doc.splitTextToSize(hero.key_insight || "", W - M * 2), M, metaY);
  }

  // Metric preview strip (bottom third)
  if (metrics?.items?.length) {
    const stripY = H - 230;
    doc.setDrawColor(35, 42, 55); doc.line(M, stripY - 20, W - M, stripY - 20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...FAINT);
    doc.text("AT A GLANCE", M, stripY - 6);
    const items = metrics.items.slice(0, 4);
    const colW = (W - M * 2) / items.length;
    items.forEach((m, i) => {
      const x = M + i * colW;
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
      doc.text(String(m.value || ""), x, stripY + 22);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...FAINT);
      doc.text(String(m.label || "").toUpperCase(), x, stripY + 38);
    });
  }

  // Footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...FAINT);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, M, H - 50);
  doc.text("Sales Intelligence Agent", W - M, H - 50, { align: "right" });

  doc.addPage(); page++;

  // ── EXECUTIVE SUMMARY ──
  if (hero) {
    heading("01", "Executive Summary & Sales Angle");
    para(hero.key_insight || "", { size: 10 });
    gap(6);
    para("SALES ANGLE", { bold: true, size: 9, color: GREEN });
    para(hero.sales_angle || "", { size: 10 });
    gap();
  }

  // ── METRICS ──
  if (metrics?.items) {
    heading("02", "Financial Health & Signals");
    metrics.items.forEach((m) => {
      need(16);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
      doc.text(m.value || "", M, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...SOFT);
      doc.text(`— ${m.label}`, M + 110, y);
      const sc = m.signal === "positive" ? GREEN : m.signal === "negative" ? RED : FAINT;
      doc.setTextColor(...sc); doc.setFontSize(8);
      doc.text((m.signal || "").toUpperCase(), W - M, y, { align: "right" });
      y += 16;
    });
    gap();
  }

  // ── CARD GRIDS (business / operations / tech) ──
  const cardSection = (num, title, data, color) => {
    if (!data?.cards) return;
    heading(num, title, color);
    data.cards.forEach((c) => {
      need(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...color);
      doc.text(c.title || "", M, y); y += 15;
      (c.bullets || []).forEach((b) => bullet(b, color));
      gap(4);
    });
    gap();
  };
  // Business model — with a revenue donut if percentages exist
  if (business?.cards) {
    heading("03", "Business Model Analysis", TEAL);
    const pctCard = business.cards.find((c) => pcts(c.bullets).length >= 2);
    if (pctCard) {
      const segs = pcts(pctCard.bullets);
      need(110);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...TEAL);
      doc.text(pctCard.title.toUpperCase(), M, y); y += 8;
      drawDonut(segs, M + 45, y + 42, 38);
      y += 100;
    }
    business.cards.forEach((c) => {
      need(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEAL);
      doc.text(c.title || "", M, y); y += 15;
      (c.bullets || []).forEach((b) => bullet(b, TEAL));
      gap(4);
    });
    gap();
  }
  cardSection("04", "Operations & Distribution", operations, PURPLE);
  cardSection("05", "Technology Stack", tech, TEAL);

  // ── PAIN POINTS ──
  if (pains?.points) {
    heading("06", "Pain Point Analysis", RED);
    {
      const high = pains.points.filter((p) => p.severity === "high").length;
      const med = pains.points.filter((p) => p.severity === "medium").length;
      const low = pains.points.filter((p) => p.severity === "low").length;
      drawSeverity(high, med, low);
    }
    pains.points.forEach((p) => {
      need(28);
      const sc = p.severity === "high" ? RED : p.severity === "medium" ? [180, 83, 9] : FAINT;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
      doc.text(p.title || "", M, y);
      doc.setFontSize(8); doc.setTextColor(...sc);
      doc.text((p.severity || "").toUpperCase(), W - M, y, { align: "right" });
      y += 13;
      para(p.description || "", { size: 9, color: SOFT }); gap(4);
    });
    gap();
  }

  // ── OPPORTUNITY TABLE ──
  if (table?.rows) {
    heading("07", "Opportunity Map");
    const cols = table.columns || [];
    const colW = (W - M * 2) / cols.length;
    need(20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...TEAL);
    cols.forEach((c, i) => doc.text((c || "").toUpperCase(), M + i * colW, y));
    y += 6; doc.setDrawColor(...LINE); doc.line(M, y, W - M, y); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...SOFT);
    table.rows.forEach((row) => {
      need(16);
      const cells = row.cells || [];
      let maxLines = 1;
      cells.forEach((cell, i) => {
        const lines = doc.splitTextToSize(String(cell || ""), colW - 6);
        maxLines = Math.max(maxLines, lines.length);
        lines.forEach((ln, li) => doc.text(ln, M + i * colW, y + li * 11));
      });
      y += maxLines * 11 + 6;
      doc.setDrawColor(...LINE); doc.line(M, y - 4, W - M, y - 4);
    });
    gap();
  }

  // ── INSIGHTS ──
  if (insights?.insights) {
    heading("08", "AI Analyst Insights");
    insights.insights.forEach((ins, i) => {
      need(16);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...TEAL);
      doc.text(String(i + 1).padStart(2, "0"), M, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...SOFT);
      const lines = doc.splitTextToSize(ins, W - M * 2 - 20);
      lines.forEach((ln, li) => { need(13); doc.text(ln, M + 20, y + li * 12); });
      y += lines.length * 12 + 5;
    });
    gap();
  }

  // ── SOLUTIONS ──
  if (solutions?.solutions) {
    heading("09", "Recommended Solution Stack", GREEN);
    solutions.solutions.forEach((s) => {
      need(40);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
      doc.text(s.name || "", M, y); y += 15;
      para("Problem: " + (s.problem_solved || ""), { size: 9, color: SOFT });
      para("Impact: " + (s.impact || ""), { size: 9, color: GREEN, bold: true });
      gap(6);
    });
    gap();
  }

  // ── PERSONAS ──
  if (personas?.personas) {
    heading("10", "Buyer Personas", PURPLE);
    personas.personas.forEach((p) => {
      need(50);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
      doc.text(p.role || "", M, y); y += 14;
      para("Focus: " + (p.focus || ""), { size: 9 });
      para("Motivation: " + (p.motivation || ""), { size: 9 });
      para("Likely objection: \"" + (p.objection || "") + "\"", { size: 9, color: RED });
      gap(6);
    });
    gap();
  }

  // ── ROADMAP ──
  if (roadmap?.phases) {
    heading("11", "Sales Strategy Roadmap", GREEN);
    roadmap.phases.forEach((phase, i) => {
      need(30);
      const c = [TEAL, PURPLE, GREEN][i % 3];
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...c);
      doc.text(`Phase ${i + 1}: ${phase.phase || ""}`, M, y); y += 15;
      (phase.actions || []).forEach((a) => bullet(a, c));
      gap(6);
    });
  }

  footer();
  doc.save(`${company.replace(/[^a-z0-9]/gi, "_")}_Intelligence_Report.pdf`);
}
