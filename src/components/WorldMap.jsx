import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { geoEqualEarth } from "d3-geo";
import { WORLD_PATH } from "../lib/worldPath.js";
import { lookupCity } from "../lib/cityCoords.js";

const projection = geoEqualEarth().scale(183.011).translate([500, 248.908]);
const VB_W = 1000, VB_H = 500;
const DEFAULT_CITIES = ["New York, USA", "London, UK", "São Paulo, Brazil", "Dubai, UAE", "Singapore", "Tokyo, Japan", "Sydney, Australia"];

function MapSVG({ plotted, expanded }) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState(null); // {label, x, y}
  const drag = useRef(null);
  const svgRef = useRef(null);

  const clampK = (k) => Math.min(8, Math.max(1, k));

  // Clamp translate so the scaled content always covers the full viewBox.
  // The land content doesn't fill the full viewBox — continents sit roughly in
  // the band y∈[55,445] across the full width. Clamp the VISIBLE window to stay
  // within these content bounds so panning never reveals empty/dark margins.
  const CONTENT = { x0: 0, y0: 55, x1: VB_W, y1: 445 };
  const clampView = useCallback((v) => {
    const k = clampK(v.k);
    if (k <= 1.001) return { k: 1, x: 0, y: 0 }; // not zoomed → no pan, perfectly centered
    // visible window in content-space is [-x/k .. (VB_W-x)/k] etc.
    // require: left ≥ CONTENT.x0  AND  right ≤ CONTENT.x1
    //   left  = -x/k ≥ x0  → x ≤ -x0*k
    //   right = (VB_W - x)/k ≤ x1 → x ≥ VB_W - x1*k
    const xMax = -CONTENT.x0 * k;
    const xMin = VB_W - CONTENT.x1 * k;
    const yMax = -CONTENT.y0 * k;
    const yMin = VB_H - CONTENT.y1 * k;
    // clamp; if range inverts (content smaller than window) center it
    const x = xMin <= xMax ? Math.min(xMax, Math.max(xMin, v.x)) : (xMin + xMax) / 2;
    const y = yMin <= yMax ? Math.min(yMax, Math.max(yMin, v.y)) : (yMin + yMax) / 2;
    return { k, x, y };
  }, []);

  // svg-space coords from a pointer event
  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    // account for letterboxing of xMidYMid meet
    const scale = Math.min(r.width / VB_W, r.height / VB_H);
    const offX = (r.width - VB_W * scale) / 2;
    const offY = (r.height - VB_H * scale) / 2;
    return { x: (e.clientX - r.left - offX) / scale, y: (e.clientY - r.top - offY) / scale };
  };

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const { x: mx, y: my } = toSvg(e);
    setView((v) => {
      const k = clampK(v.k * (e.deltaY < 0 ? 1.15 : 0.87));
      const x = mx - ((mx - v.x) * k) / v.k;
      const y = my - ((my - v.y) * k) / v.k;
      return clampView({ x, y, k });
    });
  }, [clampView]);

  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; };
  const onMove = (e) => {
    if (!drag.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const scale = Math.min(r.width / VB_W, r.height / VB_H);
    const dx = (e.clientX - drag.current.sx) / scale;
    const dy = (e.clientY - drag.current.sy) / scale;
    setView((v) => clampView({ ...v, x: drag.current.ox + dx, y: drag.current.oy + dy }));
  };
  const onUp = () => { drag.current = null; };
  const reset = () => setView({ x: 0, y: 0, k: 1 });
  const zoom = (f) => setView((v) => clampView({ ...v, k: clampK(v.k * f) }));

  const r0 = (n) => n / view.k; // size that stays constant on screen

  return (
    <>
      <svg
        ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-full w-full touch-none"
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={onUp} onPointerLeave={onUp}
        style={{ cursor: drag.current ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={WORLD_PATH} fill="var(--surface-2)" stroke="var(--ink-faint)" strokeWidth={r0(0.5)} strokeOpacity="0.5" />
          {plotted.map((m, i) => (
            <g key={`${m.label}-${i}`}
               onPointerEnter={() => setHover(m)} onPointerLeave={() => setHover(null)}
               style={{ cursor: "pointer" }}>
              {/* invisible larger hit area */}
              <circle cx={m.x} cy={m.y} r={r0(10)} fill="transparent" />
              <motion.circle cx={m.x} cy={m.y} r={r0(5)} fill="var(--teal)"
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 300 }} />
              <motion.circle cx={m.x} cy={m.y} r={r0(5)} fill="none" stroke="var(--teal)" strokeWidth={r0(1.5)}
                animate={{ r: [r0(5), r0(15)], opacity: [0.7, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.3 }} />
            </g>
          ))}
        </g>

        {/* tooltip (drawn in screen space, projected through current view) */}
        {hover && (() => {
          const sx = hover.x * view.k + view.x;
          const sy = hover.y * view.k + view.y;
          const w = Math.max(60, hover.label.length * 7 + 16);
          return (
            <g pointerEvents="none">
              <rect x={sx - w / 2} y={sy - 30} width={w} height={20} rx={4}
                fill="var(--surface)" stroke="var(--teal)" strokeWidth="0.5" />
              <text x={sx} y={sy - 16} textAnchor="middle" fontSize="11"
                fill="var(--ink)" fontFamily="JetBrains Mono, monospace">{hover.label}</text>
            </g>
          );
        })()}
      </svg>

      {/* zoom controls */}
      <div className="absolute right-2 top-2 flex flex-col gap-1" style={{ zIndex: 2 }}>
        <button onClick={() => zoom(1.3)} className="map-btn">+</button>
        <button onClick={() => zoom(1 / 1.3)} className="map-btn">−</button>
        {view.k > 1 && <button onClick={reset} className="map-btn" style={{ fontSize: 11 }}>⟲</button>}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-3 eyebrow" style={{ color: "var(--teal)", zIndex: 2 }}>
        Global Footprint{plotted.length ? ` · ${plotted.length} markets` : ""}
      </div>
    </>
  );
}

export default function WorldMap({ locations }) {
  const [expanded, setExpanded] = useState(false);
  const source = Array.isArray(locations) && locations.length ? locations : DEFAULT_CITIES;
  const points = source.map((label) => {
    const ll = lookupCity(label);
    if (!ll) return null;
    const [x, y] = projection(ll);
    return { label, x, y };
  }).filter(Boolean);
  const plotted = points.length ? points : DEFAULT_CITIES.map((label) => {
    const [x, y] = projection(lookupCity(label));
    return { label, x, y };
  });

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      {/* inline map */}
      <div className="relative h-full min-h-[200px] w-full overflow-hidden rounded-xl" style={{ background: "var(--bg-2)" }}>
        <MapSVG plotted={plotted} expanded={false} />
        {/* expand button */}
        <button onClick={() => setExpanded(true)}
          className="map-btn absolute left-2 top-2"
          style={{ zIndex: 2 }} title="Expand map">⤢</button>
      </div>

      {/* expanded overlay */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
              className="relative w-full max-w-5xl overflow-hidden rounded-2xl border"
              style={{ height: "75vh", background: "var(--bg-2)", borderColor: "var(--border)" }}
            >
              <MapSVG plotted={plotted} expanded={true} />
              <button onClick={() => setExpanded(false)}
                className="map-btn absolute left-3 top-3" style={{ zIndex: 3 }} title="Close">✕</button>
              <div className="pointer-events-none absolute right-4 top-4 eyebrow" style={{ color: "var(--ink-faint)", zIndex: 3 }}>
                Esc or click outside to exit
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}