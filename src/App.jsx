import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAgent } from "./lib/useAgent.js";
import { useTheme } from "./lib/useTheme.js";
import { useAuth } from "./lib/useAuth.js";
import { useHistory } from "./lib/useHistory.js";
import { useGroqKey } from "./lib/useGroqKey.js";
import { useUsage } from "./lib/useUsage.js";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";
import Landing from "./components/Landing.jsx";
import Generating from "./components/Generating.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Aurora from "./components/Aurora.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import AccountSettings from "./components/AccountSettings.jsx";
import GroqKeyGate from "./components/GroqKeyGate.jsx";

export default function App() {
  const { theme, toggle } = useTheme();
  const auth = useAuth();
  const history = useHistory(auth.authed);
  const groq = useGroqKey(auth.user?.id);
  const usage = useUsage(auth.session, auth.authed);

  // Give the agent a live getter for the current Groq key (read at request time).
  const groqKeyRef = useRef(groq.groqKey);
  useEffect(() => { groqKeyRef.current = groq.groqKey; }, [groq.groqKey]);
  const getGroqKey = useCallback(() => groqKeyRef.current, []);

  // Live getter for the Supabase access token (for the server-side daily limit).
  const tokenRef = useRef(auth.session?.access_token);
  useEffect(() => { tokenRef.current = auth.session?.access_token; }, [auth.session]);
  const getToken = useCallback(() => tokenRef.current, []);

  const {
    blocks, current, phase, error,
    doneCount, usableCount, lastFailed, nextStepName, stepNames, allSections, totalSteps, effectiveTotal,
    start, next, runStep, finishHere, reset, restore, getBrief,
  } = useAgent({ getGroqKey, getToken });
  const [company, setCompany] = useState("");
  const [authModal, setAuthModal] = useState(null); // null | "login" | "signup"
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // "Welcome" vs "Welcome back".
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
  const running = phase === "running";
  const generating = phase === "running" || phase === "waiting" || phase === "error";
  const done = phase === "done";

  // Track how many usable sections we last saved, so we save once per new
  // section rather than on every render.
  const savedCountRef = useRef(0);
  // Reset the save tracker whenever a brand-new analysis starts.
  useEffect(() => { if (running && doneCount === 0) savedCountRef.current = 0; }, [running, doneCount]);

  // After section 1 completes (a new Brave search just happened), refresh the
  // daily usage pill so the remaining count updates live.
  useEffect(() => { if (usableCount === 1) usage.refresh(); }, [usableCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to history after EACH section completes (partial reports allowed).
  // history.save upserts by company, so repeated calls just update the same
  // entry's blocks + timestamp — no duplicates. We also persist the research
  // brief so resuming later costs no new Brave search.
  useEffect(() => {
    if (!company) return;
    if (usableCount > savedCountRef.current && blocks.length > 0) {
      savedCountRef.current = usableCount;
      history.save(company, blocks, getBrief());
    }
  }, [usableCount, blocks, company, history, getBrief]);

  // Save-on-leave: when the user starts a new analysis or resets, persist the
  // latest state first (covers any last section not yet flushed).
  const saveThenRun = useCallback((fn) => {
    if (company && blocks.length > 0 && usableCount > 0) {
      history.save(company, blocks, getBrief());
    }
    fn();
  }, [company, blocks, usableCount, history, getBrief]);

  // Restore a saved report without re-running the AI. Partial reports resume
  // (the report shows so far, with the Generate button to continue). The saved
  // brief is passed through so resuming reuses it — no new Brave search.
  const handleRestore = (r) => {
    savedCountRef.current = (r.blocks || []).filter((b) => b && b.blockData != null).length;
    setCompany(r.company);
    setShowHistory(false);
    restore(r.blocks, { company: r.company, brief: r.brief });
    history.touch(r.id);
  };

  // Start a fresh analysis — no daily-limit check anymore (BYOK).
  const handleStart = (opts) => {
    setCompany(opts.company);
    start(opts);
  };

  const needsAuth = isSupabaseConfigured && !auth.loading && !auth.authed;
  const needsKey = auth.authed && groq.loaded && !groq.hasKey;

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
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => saveThenRun(reset)}
                className="font-mono rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wide ink-soft transition hover:border-teal hover:text-teal">
                New Analysis
              </motion.button>
            )}
            {auth.authed && (
              <>
                {usage.configured && usage.remaining !== null && (
                  <span className="font-mono hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:flex"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                    title="Daily company searches remaining (resets midnight UTC)">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: usage.remaining > 0 ? "var(--teal)" : "var(--red)" }} />
                    <span className="ink-soft">{usage.remaining} of {usage.limit} left</span>
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

      {/* Authenticated but no key yet → key gate takes over the main area. */}
      {needsKey && !active ? (
        <GroqKeyGate onSave={groq.setGroqKey} />
      ) : (
        <>
          <AnimatePresence mode="wait">
            {!active && (
              <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
                <div className="relative">
                  <Landing onStart={handleStart} disabled={generating || needsAuth} lockInteractive={needsAuth}
                    allSections={allSections}
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

            {/* Before the first section exists, show the building screen.
                Once any section is done, the report itself renders live and
                builds in place (Dashboard with building controls). */}
            {active && generating && usableCount === 0 && (
              <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                <Generating
                  company={company}
                  doneCount={doneCount}
                  usableCount={usableCount}
                  lastFailed={lastFailed}
                  current={current}
                  error={error}
                  running={running}
                  stepNames={stepNames}
                  totalSteps={effectiveTotal}
                  onNext={next}
                  onFinish={finishHere}
                />
              </motion.div>
            )}

            {active && usableCount > 0 && (
              <motion.div key="dash" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 80, damping: 18 }}>
                <Dashboard
                  blocks={blocks}
                  company={company}
                  onReset={() => saveThenRun(reset)}
                  building={!done}
                  running={running}
                  doneCount={doneCount}
                  usableCount={usableCount}
                  totalSteps={effectiveTotal}
                  nextStepName={nextStepName}
                  error={error}
                  lastFailed={lastFailed}
                  onNext={next}
                />
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
              <AccountSettings auth={auth} groq={groq} onClose={() => setShowSettings(false)} />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
