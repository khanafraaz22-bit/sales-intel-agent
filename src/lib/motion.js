// Shared motion presets — "bold & lively" springy feel, reused app-wide.
// Respects prefers-reduced-motion via the reduceMotion helper in components.

export const spring = { type: "spring", stiffness: 320, damping: 26, mass: 0.9 };
export const springSoft = { type: "spring", stiffness: 180, damping: 22 };

// A block container that slides + fades in, and staggers its children.
export const blockContainer = {
  hidden: { opacity: 0, y: 28, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...spring, staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

// Children of a staggered container (cards, rows, bullets, metrics).
export const staggerItem = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
};

// Scroll-reveal for landing sections (fires once when in view).
export const revealUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { ...springSoft, duration: 0.6 } },
};

// Hero word-by-word reveal.
export const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
export const heroWord = {
  hidden: { opacity: 0, y: 30, rotateX: -40 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: spring },
};
