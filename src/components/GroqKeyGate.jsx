import { useState } from "react";
import { motion } from "framer-motion";

// Shown when an authenticated user has no Groq key saved on this device yet.
// Walks them through getting a free key and saving it (browser-only, per device).
export default function GroqKeyGate({ onSave }) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const valid = value.trim().length >= 20;
  const save = () => {
    setTouched(true);
    if (!valid) return;
    onSave(value.trim());
  };

  return (
    <div className="mx-auto max-w-xl px-4 pt-20 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
        className="card p-8"
        style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)", backdropFilter: "blur(14px)" }}>

        <div className="eyebrow" style={{ color: "var(--teal)" }}>One-time setup</div>
        <h1 className="font-display mt-2 text-2xl font-bold ink">Add your free Groq API key</h1>
        <p className="text-body mt-2 text-sm ink-soft">
          This app runs on your own free Groq key, so analyses are fast and there are no shared limits.
          It takes about a minute to get one.
        </p>

        {/* Steps */}
        <ol className="mt-6 space-y-3">
          {[
            <>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="font-medium underline" style={{ color: "var(--teal)" }}>console.groq.com/keys</a> and sign in (Google/GitHub works).</>,
            <>Click <span className="font-medium ink">Create API Key</span>, give it any name, and create it.</>,
            <>Copy the key (it starts with <span className="font-mono ink">gsk_</span>) — you only see it once.</>,
            <>Paste it below and click Save.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm ink-soft">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                style={{ background: "var(--surface-2)", color: "var(--teal)" }}>{i + 1}</span>
              <span className="text-body pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {/* Key input */}
        <div className="mt-6">
          <label className="eyebrow">Groq API Key</label>
          <input
            type="password" value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="gsk_..."
            className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
            style={{ borderColor: touched && !valid ? "var(--red)" : "var(--border)", background: "var(--surface-2)" }} />
          {touched && !valid && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--red)" }}>That doesn't look like a valid key. It should start with gsk_ and be fairly long.</p>
          )}
        </div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={save}
          className="font-mono mt-5 w-full rounded-lg py-3 text-sm font-semibold uppercase tracking-wide"
          style={{ background: "var(--teal)", color: "var(--bg)" }}>
          Save key & continue
        </motion.button>

        {/* Privacy note */}
        <div className="mt-5 rounded-lg border p-3 text-xs ink-faint"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <span className="font-medium ink-soft">Where your key is stored:</span> only in this browser, on this device.
          It is never sent to or saved on our servers — each analysis passes it straight to Groq and nothing is kept.
          You can update or remove it anytime in Account Settings. Signing in on another device will ask for it again.
        </div>
      </motion.div>
    </div>
  );
}
