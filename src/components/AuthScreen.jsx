import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthScreen({ auth, onClose, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // login | signup
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async () => {
    setError(null); setNotice(null);
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    if (mode === "signup" && !fullName.trim()) { setError("Please enter your full name."); return; }
    if (mode === "signup" && !username.trim()) { setError("Please choose a username."); return; }
    if (mode === "signup" && username.trim().length < 2) { setError("Username must be at least 2 characters."); return; }
    if (mode === "signup" && password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await auth.signUp(email.trim(), password, username.trim(), fullName.trim());
        if (error) setError(error.message);
        else setNotice("Account created. Check your email for a verification link, then come back and log in.");
      } else {
        const { error } = await auth.signIn(email.trim(), password);
        if (error) {
          // Supabase returns this when email isn't confirmed yet.
          if (/confirm/i.test(error.message)) setError("Please verify your email first — check your inbox.");
          else setError(error.message);
        }
      }
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setError(null); setNotice(null);
    const { error } = await auth.resendVerification(email.trim());
    if (error) setError(error.message);
    else setNotice("Verification email resent.");
  };

  return (
    <div
      className={onClose ? "fixed inset-0 z-50 flex items-center justify-center px-4" : "relative flex min-h-[80vh] items-center justify-center px-4"}
      style={onClose ? { background: "color-mix(in srgb, var(--bg) 75%, transparent)", backdropFilter: "blur(6px)" } : undefined}
      onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
        className="card relative w-full max-w-md p-8"
        style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(14px)" }}
      >
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 text-lg ink-faint transition hover:text-teal" aria-label="Close">✕</button>
        )}
        <div className="eyebrow" style={{ color: "var(--teal)" }}>Enterprise Tier · Secure Access</div>
        <h1 className="font-display mt-2 text-3xl font-bold ink">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-body mt-2 text-sm ink-soft">
          {mode === "login" ? "Access your sales intelligence workspace." : "Sign up with your email to get started. You'll verify it before first use."}
        </p>

        <div className="mt-6 space-y-3">
          {mode === "signup" && (
            <div>
              <label className="eyebrow">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="e.g. Jessica Wu"
                className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            </div>
          )}
          {mode === "signup" && (
            <div>
              <label className="eyebrow">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="How others see you"
                className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            </div>
          )}
          <div>
            <label className="eyebrow">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@company.com"
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
          </div>
          <div>
            <label className="eyebrow">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mt-3 rounded-lg p-3 text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              {error}
              {/confirm|verify/i.test(error) && (
                <button onClick={resend} className="ml-2 underline">Resend email</button>
              )}
            </motion.div>
          )}
          {notice && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mt-3 rounded-lg p-3 text-sm" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
              {notice}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={submit} disabled={busy}
          className="font-mono mt-5 w-full rounded-lg py-3 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
          style={{ background: "var(--teal)", color: "var(--bg)" }}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </motion.button>

        <div className="mt-4 text-center text-sm ink-soft">
          {mode === "login" ? "No account yet? " : "Already have one? "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setNotice(null); }}
            className="font-medium" style={{ color: "var(--teal)" }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}