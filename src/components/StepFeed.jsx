import { motion, AnimatePresence } from "framer-motion";
import Hero from "./blocks/Hero.jsx";
import Metrics from "./blocks/Metrics.jsx";
import CardGrid from "./blocks/CardGrid.jsx";
import Table from "./blocks/Table.jsx";
import PainPoints from "./blocks/PainPoints.jsx";
import Insights from "./blocks/Insights.jsx";
import Solutions from "./blocks/Solutions.jsx";
import Personas from "./blocks/Personas.jsx";
import Roadmap from "./blocks/Roadmap.jsx";
import { blockContainer, spring } from "../lib/motion.js";

const REGISTRY = {
  HERO: Hero, METRICS: Metrics, CARD_GRID: CardGrid, TABLE: Table,
  PAIN_POINTS: PainPoints, INSIGHTS: Insights, SOLUTIONS: Solutions,
  PERSONAS: Personas, ROADMAP: Roadmap,
};

function StepBlock({ step }) {
  const Component = REGISTRY[step.blockType];
  const isHero = step.blockType === "HERO";
  return (
    <motion.section
      variants={blockContainer}
      initial="hidden"
      animate="show"
      layout
    >
      {!isHero && (
        <motion.div
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={spring}
          className="mb-3 flex items-baseline gap-3"
        >
          {step.stepNumber != null && (
            <span className="font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>
              {String(step.stepNumber).padStart(2, "0")}
            </span>
          )}
          {step.stepTitle && <h2 className="text-base font-bold ink">{step.stepTitle}</h2>}
        </motion.div>
      )}
      {step.thought && !isHero && <p className="mb-3 text-sm italic ink-faint">{step.thought}</p>}
      {Component
        ? <Component data={step.blockData} />
        : <pre className="panel overflow-auto p-3 text-xs ink">{JSON.stringify(step.blockData, null, 2)}</pre>}
    </motion.section>
  );
}

export default function StepFeed({ blocks }) {
  return (
    <div className="space-y-8">
      <AnimatePresence mode="popLayout">
        {blocks.map((s, i) => <StepBlock key={i} step={s} />)}
      </AnimatePresence>
    </div>
  );
}
