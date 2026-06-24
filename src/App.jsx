import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useAgent } from "./lib/useAgent.js";
import { useTheme } from "./lib/useTheme.js";
import { useAuth } from "./lib/useAuth.js";
import { useUsage } from "./lib/useUsage.js";
import { useHistory } from "./lib/useHistory.js";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";
import Landing from "./components/Landing.jsx";
import Generating from "./components/Generating.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Aurora from "./components/Aurora.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import AccountSettings from "./components/AccountSettings.jsx";

export default function App() {
  const { theme, toggle } = useTheme();
  const auth = useAuth();
  const usage = useUsage(auth.session, auth.authed);
  const history = useHistory(auth.authed);
  const { blocks, current, phase, error, cooldown, start, runStep, reset, restore } = useAgent();
  const [company, setCompany] = useState("");
  const [limitMsg, setLimitMsg] = useState(null);
  const [authModal, setAuthModal] = useState(null); // null | "login" | "signup"
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const savedRef = useRef(false); // guard so each finished report saves once

  // "Welcome" (first time this browser sees them signed in) vs "Welcome back".
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    if (auth.authed && auth.user) {
      const key = `seen_${auth.user.id}`;
      try {
        if (!localStorage.getItem(key)) { setIsFirstVisit(true); localStorage.setItem(key, "1"); }
        else setIsFirstVisit(false);
      } catch { /* localStorage unavailable */ }
    }
  }, [auth.authed, auth.user]);

  const active = phase !== "idle";
  const generating = phase === "running" || phase === "waiting" || phase === "error";
  const done = phase === "done";

  // Reset the save-guard whenever a new generation starts.
  useEffect(() => { if (generating) savedRef.current = false; }, [generating]);

  // Auto-save a finished report to history (once).
  useEffect(() => {
    if (done && !savedRef.current && blocks.length > 0 && company) {
      savedRef.current = true;
      history.save(company, blocks);
    }
  }, [done, blocks, company, history]);

  // Restore a saved report without re-running the AI.
  const handleRestore = (r) => {
    savedRef.current = true; // prevent the auto-save effect from re-saving this restored report
    setCompany(r.company);
    setShowHistory(false);
    restore(r.blocks);
    history.touch(r.id); // just bump its last-opened time, no new history entry
  };

  // Check the per-user daily limit before starting a generation.
  const handleStart = async (opts) => {
    setLimitMsg(null);
    try {
      const token = auth.session?.access_token;
      const resp = await fetch("/api/check-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) { setLimitMsg(data.error || "Could not verify your usage limit."); return; }
      usage.applyResult(data);
      if (!data.allowed) {
        setLimitMsg(`You've reached your daily limit of ${data.limit} reports. Try again tomorrow.`);
        return;
      }
      setCompany(opts.company);
      start(opts);
    } catch {
      setLimitMsg("Could not reach the server to verify your limit.");
    }
  };

  return (
    <div className="min-h-screen">
      <Aurora dim={done} />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <motion.span whileHover={{ rotate: -8, scale: 1.1 }} className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--teal)", color: "var(--bg)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg>
            </motion.span>
            <div className="leading-tight">
              <div className="font-display text-sm font-bold ink">Intelligence</div>
              <div className="eyebrow" style={{ fontSize: "0.55rem" }}>Enterprise Tier</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={reset}
                className="font-mono rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal">
                New Analysis
              </motion.button>
            )}
            {auth.authed && (
              <>
                {usage.remaining !== null && (
                  <span className="font-mono hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs sm:flex"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: usage.remaining > 0 ? "var(--green)" : "var(--red)" }} />
                    <span style={{ color: usage.remaining > 0 ? "var(--teal)" : "var(--red)" }}>{usage.remaining}</span>
                    <span className="ink-faint">of {usage.usage.limit} left</span>
                  </span>
                )}
                <button onClick={() => setShowSettings(true)}
                  className="hidden items-center gap-1.5 rounded-lg px-1.5 py-1 transition hover:bg-[var(--surface-2)] sm:flex" title="Account settings">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--teal)", color: "var(--bg)" }}>
                    {(auth.username || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="font-mono text-xs ink-soft">{auth.username}</span>
                </button>
                <button onClick={auth.signOut}
                  className="font-mono rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wide ink-soft transition hover:border-red hover:text-red"
                  style={{ borderColor: "var(--border)" }}>
                  Sign out
                </button>
              </>
            )}
            {isSupabaseConfigured && !auth.loading && !auth.authed && (
              <button onClick={() => setAuthModal("login")}
                className="font-mono rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal"
                style={{ borderColor: "var(--border)" }}>
                Sign in
              </button>
            )}
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
        </div>
      </header>

      {/* Landing is always visible. When auth is required but the user isn't
          signed in, the interactive area is blurred/locked with an unlock prompt;
          the title stays sharp. Sign in/up opens as a modal. */}
      {(() => {
        const needsAuth = isSupabaseConfigured && !auth.loading && !auth.authed;
        return (
          <>
            <AnimatePresence mode="wait">
              {!active && (
                <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
                  {limitMsg && (
                    <div className="mx-auto mt-6 max-w-md rounded-lg p-3 text-center text-sm" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                      {limitMsg}
                    </div>
                  )}
                  <div className="relative">
                    {/* lock only the interactive area below the title when auth needed */}
                    <Landing onStart={handleStart} disabled={generating || needsAuth} lockInteractive={needsAuth}
                      greetingName={auth.authed ? `${isFirstVisit ? "Welcome" : "Welcome back"}, ${auth.firstName}` : null} />
                    {needsAuth && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[clamp(280px,42vh,460px)] flex items-start justify-center">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          className="pointer-events-auto mt-4 flex flex-col items-center gap-3 rounded-2xl border px-8 py-6 text-center"
                          style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--surface-2)", color: "var(--teal)" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </div>
                          <div className="font-display text-lg font-bold ink">Sign in to generate intelligence</div>
                          <p className="text-body max-w-xs text-sm ink-soft">Create a free account or sign in to run company analyses. Verified email required.</p>
                          <div className="mt-1 flex gap-2">
                            <button onClick={() => setAuthModal("login")}
                              className="font-mono rounded-lg px-5 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ background: "var(--teal)", color: "var(--bg)" }}>Sign in</button>
                            <button onClick={() => setAuthModal("signup")}
                              className="font-mono rounded-lg border px-5 py-2.5 text-xs font-semibold uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal" style={{ borderColor: "var(--border)" }}>Create account</button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>

                  {/* Per-user history — only when signed in */}
                  {auth.authed && (
                    <HistoryPanel
                      open={showHistory}
                      onToggle={() => setShowHistory((v) => !v)}
                      items={history.items}
                      loading={history.loading}
                      onRestore={handleRestore}
                      onDelete={history.remove}
                    />
                  )}
                </motion.div>
              )}

              {active && generating && (
                <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <Generating company={company} doneCount={blocks.length} current={current} cooldown={cooldown} error={error}
                    onRetry={(phase === "waiting" || phase === "error") ? runStep : null} />
                </motion.div>
              )}

              {done && (
                <motion.div key="dash" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 80, damping: 18 }}>
                  <Dashboard blocks={blocks} company={company} onReset={reset} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auth modal */}
            <AnimatePresence>
              {authModal && needsAuth && (
                <AuthScreen auth={auth} initialMode={authModal} onClose={() => setAuthModal(null)} />
              )}
            </AnimatePresence>

            {/* Account settings modal */}
            <AnimatePresence>
              {showSettings && auth.authed && (
                <AccountSettings auth={auth} onClose={() => setShowSettings(false)} />
              )}
            </AnimatePresence>
          </>
        );
      })()}
    </div>
  );
}