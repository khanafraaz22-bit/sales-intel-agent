import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ── Reusable animated widgets for the command center ──

// Count-up number that rolls from 0 to `value` when it scrolls into view.
function CountUp({ value, className, style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;
    const dur = 900; const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return <span ref={ref} className={className} style={style}>{n.toLocaleString()}</span>;
}

// Small donut ring for role breakdown. segments: [{label,value,color}].
function MiniDonut({ segments, size = 108 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 10, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * C;
        const el = (
          <motion.circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="10"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 * i }} strokeLinecap="round" />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// Gradient area+line chart for searches over time. data: [{day,count}].
function AreaChart({ data, color = "var(--teal)", height = 96 }) {
  if (!data.length) return null;
  const W = 320, H = height, pad = 6;
  const max = Math.max(1, ...data.map((d) => d.count));
  const pts = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2);
    const y = H - pad - (d.count / max) * (H - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const gid = "areaGrad" + Math.random().toString(36).slice(2, 7);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
      {pts.map((p, i) => (
        <motion.circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.03 }}>
          <title>{`${data[i].day}: ${data[i].count}`}</title>
        </motion.circle>
      ))}
    </svg>
  );
}

// Ranked row with a volume bar behind the label. rank 0/1/2 get medal accents.
function RankRow({ label, count, max, rank, color }) {
  const pct = Math.max(4, (count / Math.max(1, max)) * 100);
  const medal = ["#F5C518", "#C0C7D0", "#CD7F32"][rank]; // gold/silver/bronze
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ background: "var(--surface-2)" }}>
      <motion.div className="absolute inset-y-0 left-0" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
      <div className="relative flex items-center justify-between px-3 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: medal || "var(--surface)", color: medal ? "#1a1a1a" : "var(--ink-faint)" }}>{rank + 1}</span>
          <span className="truncate text-sm ink-soft">{label}</span>
        </span>
        <span className="font-mono text-xs font-bold ink">{count}</span>
      </div>
    </div>
  );
}

// Hidden admin surface (only mounted for elevated users). Two tabs:
// Users (list, change role, remove) and Analytics (aggregate stats). All data
// comes from role-checked server endpoints; the UI is only the presentation.
export default function AdminPanel({ open, onClose, token, sections = [], settingsHook = null, isAdmin = false }) {
  const [tab, setTab] = useState("users");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, var(--bg) 75%, transparent)", backdropFilter: "blur(6px)" }}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="card relative flex w-full max-w-3xl flex-col p-0"
            style={{ background: "var(--surface)", maxHeight: "86vh" }}>
            {/* header */}
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <span className="pill-tag" style={{ background: "color-mix(in srgb, var(--purple) 16%, transparent)", color: "var(--purple)" }}>ADMIN</span>
                <h2 className="font-display text-lg font-bold ink">Control Center</h2>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-sm ink-faint transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">✕</button>
            </div>

            {/* tabs */}
            <div className="flex gap-1 border-b px-4 pt-3" style={{ borderColor: "var(--border)" }}>
              {[
                ["users", <path key="u" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />],
                ["analytics", <path key="a" d="M3 3v18h18M18 9l-5 5-3-3-4 4" />],
                ["config", <><circle key="c1" cx="12" cy="12" r="3" /><path key="c2" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>],
              ].map(([t, icon]) => (
                <button key={t} onClick={() => setTab(t)}
                  className="font-mono flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs uppercase tracking-wide transition"
                  style={{ color: tab === t ? "var(--purple)" : "var(--ink-faint)", borderBottom: tab === t ? "2px solid var(--purple)" : "2px solid transparent" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                  {t}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-6">
              {tab === "users" ? <UsersTab token={token} isAdmin={isAdmin} />
                : tab === "analytics" ? <AnalyticsTab token={token} />
                : <ConfigTab sections={sections} settingsHook={settingsHook} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UsersTab({ token, isAdmin = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null); // userId being acted on
  const [confirmRemove, setConfirmRemove] = useState(null); // userId pending confirm

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/admin-users", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load.");
      setUsers(d.users || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const setRole = async (userId, role) => {
    setBusy(userId); setErr(null);
    try {
      const r = await fetch("/api/admin-set-role", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, role }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed.");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  const removeUser = async (userId) => {
    setBusy(userId); setErr(null);
    try {
      const r = await fetch("/api/admin-remove-user", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed.");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmRemove(null);
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  if (loading) return <p className="text-center text-sm ink-faint">Loading users…</p>;

  return (
    <div>
      {err && <div className="mb-4 rounded-lg p-3 text-center text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{err}</div>}
      <div className="space-y-2">
        {users.map((u) => {
          const roleColor = u.role === "admin" ? "var(--red)" : u.role === "manager" ? "var(--purple)" : "var(--ink-faint)";
          const initials = (u.username || u.email || "?").slice(0, 2).toUpperCase();
          return (
            <motion.div key={u.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="card card-glow flex flex-wrap items-center justify-between gap-3 p-3"
              style={{ boxShadow: `inset 3px 0 0 ${roleColor}` }}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="orb-badge h-9 w-9 text-xs"
                  style={{ background: `color-mix(in srgb, ${roleColor} 18%, transparent)`, color: roleColor }}>{initials}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold ink">{u.username || u.email}</span>
                    {u.is_self && <span className="pill-tag" style={{ background: "var(--surface-2)", color: "var(--teal)" }}>YOU</span>}
                  </div>
                  {u.username && <div className="truncate text-xs ink-soft">{u.email}</div>}
                  <div className="font-mono text-[11px] ink-faint">{u.report_count} reports · {u.searches_today} today</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <>
                    {/* role selector (admin only) */}
                    <select value={u.role} disabled={busy === u.id}
                      onChange={(e) => setRole(u.id, e.target.value)}
                      className="font-mono rounded-lg border bg-transparent px-2 py-1 text-xs uppercase tracking-wide"
                      style={{ borderColor: "var(--border)", color: roleColor }}>
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                    {/* remove (admin only) */}
                    {!u.is_self && (
                      confirmRemove === u.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => removeUser(u.id)} disabled={busy === u.id}
                            className="font-mono rounded-lg px-2 py-1 text-[11px] uppercase text-white" style={{ background: "var(--red)" }}>
                            {busy === u.id ? "…" : "Confirm"}
                          </button>
                          <button onClick={() => setConfirmRemove(null)}
                            className="font-mono rounded-lg border px-2 py-1 text-[11px] uppercase ink-faint" style={{ borderColor: "var(--border)" }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRemove(u.id)}
                          className="font-mono rounded-lg border px-2 py-1 text-[11px] uppercase tracking-wide transition hover:border-red hover:text-red ink-faint"
                          style={{ borderColor: "var(--border)" }}>Remove</button>
                      )
                    )}
                  </>
                ) : (
                  // Manager view: role is read-only.
                  <span className="font-mono rounded-lg border px-2 py-1 text-xs uppercase tracking-wide"
                    style={{ borderColor: "var(--border)", color: roleColor }}>{u.role}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsTab({ token }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin-analytics", { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed.");
        setData(d);
      } catch (e) { setErr(e.message); }
    })();
  }, [token]);

  if (err) return <div className="rounded-lg p-3 text-center text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{err}</div>;
  if (!data) return <p className="text-center text-sm ink-faint">Loading analytics…</p>;

  const roleColors = { admin: "var(--red)", manager: "var(--purple)", user: "var(--teal)" };
  const roleSegs = Object.entries(data.roleBreakdown)
    .filter(([, n]) => n > 0)
    .map(([role, n]) => ({ label: role, value: n, color: roleColors[role] || "var(--ink-faint)" }));
  const maxCompany = Math.max(1, ...data.topCompanies.map((c) => c.count));
  const maxUser = Math.max(1, ...data.topUsers.map((u) => u.count));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* stat cards with count-up + gradient orb */}
      <div className="grid grid-cols-3 gap-3">
        {[["Users", data.totals.users, "var(--teal)"], ["Reports", data.totals.reports, "var(--purple)"], ["Searches", data.totals.searches, "var(--green)"]].map(([label, val, c], i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card card-orb relative overflow-hidden p-4 text-center">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${c} 30%, transparent), transparent 70%)` }} />
            <CountUp value={val} className="font-display text-3xl font-bold" style={{ color: c }} />
            <div className="eyebrow mt-1">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* role donut + searches area chart, side by side */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="eyebrow mb-2">Role Distribution</div>
          {roleSegs.length > 0 ? (
            <div className="flex items-center gap-4">
              <MiniDonut segments={roleSegs} />
              <div className="space-y-1.5">
                {roleSegs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="capitalize ink-soft">{s.label}</span>
                    <span className="font-mono font-bold ink">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs ink-faint">No data yet.</p>}
        </div>

        <div className="card p-4">
          <div className="eyebrow mb-2">Searches · last {data.usageByDay.length || 0} days</div>
          {data.usageByDay.length > 0
            ? <AreaChart data={data.usageByDay} />
            : <p className="text-xs ink-faint">No search activity yet.</p>}
        </div>
      </div>

      {/* top companies + most active as ranked volume rows */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="eyebrow mb-3">Top Companies</div>
          <div className="space-y-1.5">
            {data.topCompanies.length === 0 && <p className="text-xs ink-faint">No data yet.</p>}
            {data.topCompanies.map((c, i) => (
              <RankRow key={c.company} label={c.company} count={c.count} max={maxCompany} rank={i} color="var(--purple)" />
            ))}
          </div>
        </div>
        <div className="card p-4">
          <div className="eyebrow mb-3">Most Active Users</div>
          <div className="space-y-1.5">
            {data.topUsers.length === 0 && <p className="text-xs ink-faint">No data yet.</p>}
            {data.topUsers.map((u, i) => (
              <RankRow key={u.email} label={u.email} count={u.count} max={maxUser} rank={i} color="var(--teal)" />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ConfigTab({ sections, settingsHook }) {
  const current = settingsHook?.settings || { infrabeat_text: null, title_overrides: {} };
  const [ibText, setIbText] = useState(current.infrabeat_text || "");
  const [titles, setTitles] = useState(() => {
    // Seed with current effective titles so admin edits from a full list.
    const seed = {};
    (sections || []).forEach((s) => { seed[s.n] = (current.title_overrides?.[String(s.n)]) || s.title; });
    return seed;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    // Only send title overrides that DIFFER from the default section title.
    const overrides = {};
    (sections || []).forEach((s) => {
      const v = (titles[s.n] || "").trim();
      if (v && v !== s.defaultTitle) overrides[String(s.n)] = v;
    });
    const res = await settingsHook.save({ infrabeat_text: ibText, title_overrides: overrides });
    setSaving(false);
    setMsg(res.ok ? "Saved — applies to everyone now." : (res.error || "Failed."));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-2" style={{ color: "var(--purple)" }}>InfraBeat Positioning Text</div>
        <p className="mb-2 text-xs ink-faint">Used in sections 12–13 to describe InfraBeat's capabilities. Changes apply to all future reports.</p>
        <textarea value={ibText} onChange={(e) => setIbText(e.target.value)} rows={6}
          className="w-full rounded-lg border bg-transparent p-3 text-sm ink" style={{ borderColor: "var(--border)" }}
          placeholder="InfraBeat Technologies is a…" />
      </div>

      <div>
        <div className="eyebrow mb-2" style={{ color: "var(--purple)" }}>Section Titles</div>
        <p className="mb-2 text-xs ink-faint">Rename any section. Blank/unchanged uses the default.</p>
        <div className="space-y-2">
          {(sections || []).map((s) => (
            <div key={s.n} className="flex items-center gap-2">
              <span className="font-mono w-6 text-xs ink-faint">{String(s.n).padStart(2, "0")}</span>
              <input value={titles[s.n] || ""} onChange={(e) => setTitles((t) => ({ ...t, [s.n]: e.target.value }))}
                className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm ink" style={{ borderColor: "var(--border)" }} />
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="rounded-lg p-3 text-center text-sm" style={{ background: msg.startsWith("Saved") ? "var(--green-soft, var(--surface-2))" : "var(--red-soft)", color: msg.startsWith("Saved") ? "var(--green)" : "var(--red)" }}>{msg}</div>}
      <button onClick={save} disabled={saving}
        className="font-mono w-full rounded-lg px-6 py-3 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
        style={{ background: "var(--purple)", color: "var(--bg)" }}>
        {saving ? "Saving…" : "Save global config"}
      </button>
    </div>
  );
}
