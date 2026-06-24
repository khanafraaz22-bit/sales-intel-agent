import { useEffect, useRef, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// Full-site living background: drifting + mouse-parallax aurora blobs, a fine
// grid texture, and twinkling light particles. `dim` lowers intensity behind
// dense content (the dashboard) so data stays readable.
export default function Aurora({ dim = false }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 35, damping: 22 });
  const sy = useSpring(my, { stiffness: 35, damping: 22 });

  const ref = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  const p1x = useTransform(sx, [0, 1], [-40, 40]);
  const p1y = useTransform(sy, [0, 1], [-28, 28]);
  const p2x = useTransform(sx, [0, 1], [36, -36]);
  const p2y = useTransform(sy, [0, 1], [28, -28]);
  const p3x = useTransform(sx, [0, 1], [-22, 22]);

  const blobOpacity = dim ? 0.28 : 0.55;

  // twinkling particles (fixed positions, random timings)
  const stars = useMemo(
    () => Array.from({ length: dim ? 26 : 44 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      d: 2 + Math.random() * 4,      // duration
      delay: Math.random() * 5,
      s: Math.random() < 0.5 ? 1 : 1.6, // size
      c: Math.random() < 0.6 ? "var(--teal)" : Math.random() < 0.5 ? "var(--cyan)" : "var(--purple)",
    })),
    [dim]
  );

  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* grid texture */}
      <div className="absolute inset-0" style={{
        opacity: dim ? 0.03 : 0.05,
        backgroundImage: "linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black, transparent)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black, transparent)",
      }} />

      {/* aurora blobs: outer = mouse parallax, inner = CSS drift */}
      <motion.div className="absolute" style={{ x: p1x, y: p1y, top: "-12%", left: "4%", opacity: blobOpacity }}>
        <div className="aurora-blob aurora-1" style={{ width: "46vw", height: "46vw",
          background: "radial-gradient(circle at 30% 30%, var(--teal), transparent 70%)" }} />
      </motion.div>
      <motion.div className="absolute" style={{ x: p2x, y: p2y, top: "-6%", right: "2%", opacity: blobOpacity }}>
        <div className="aurora-blob aurora-2" style={{ width: "42vw", height: "42vw",
          background: "radial-gradient(circle at 70% 40%, var(--purple), transparent 70%)" }} />
      </motion.div>
      <motion.div className="absolute" style={{ x: p3x, bottom: "-10%", left: "30%", opacity: blobOpacity }}>
        <div className="aurora-blob aurora-3" style={{ width: "40vw", height: "40vw",
          background: "radial-gradient(circle at 50% 50%, var(--cyan), transparent 65%)" }} />
      </motion.div>

      {/* twinkling lights */}
      <svg className="absolute inset-0 h-full w-full">
        {stars.map((st, i) => (
          <motion.circle
            key={i} cx={`${st.x}%`} cy={`${st.y}%`} r={st.s} fill={st.c}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: st.d, delay: st.delay, repeat: Infinity, repeatDelay: Math.random() * 3, ease: "easeInOut" }}
            style={{ filter: "drop-shadow(0 0 3px currentColor)" }}
          />
        ))}
      </svg>
    </div>
  );
}
