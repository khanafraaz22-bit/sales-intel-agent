import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Hidden admin surface (only mounted for elevated users). Two tabs:
// Users (list, change role, remove) and Analytics (aggregate stats). All data
// comes from role-checked server endpoints; the UI is only the presentation.
export default function AdminPanel({ open, onClose, token }) {
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
              {["users", "analytics"].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="font-mono rounded-t-lg px-4 py-2 text-xs uppercase tracking-wide transition"
                  style={{ color: tab === t ? "var(--purple)" : "var(--ink-faint)", borderBottom: tab === t ? "2px solid var(--purple)" : "2px solid transparent" }}>
                  {t}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-6">
              {tab === "users" ? <UsersTab token={token} /> : <AnalyticsTab token={token} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UsersTab({ token }) {
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
          return (
            <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold ink">{u.email}</span>
                  {u.is_self && <span className="pill-tag" style={{ background: "var(--surface-2)", color: "var(--teal)" }}>YOU</span>}
                </div>
                <div className="font-mono text-[11px] ink-faint">{u.report_count} reports · {u.searches_today} today</div>
              </div>
              <div className="flex items-center gap-2">
                {/* role selector */}
                <select value={u.role} disabled={busy === u.id}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  className="font-mono rounded-lg border bg-transparent px-2 py-1 text-xs uppercase tracking-wide"
                  style={{ borderColor: "var(--border)", color: roleColor }}>
                  <option value="user">user</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
                {/* remove */}
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
              </div>
            </div>
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

  const maxDay = Math.max(1, ...data.usageByDay.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[["Users", data.totals.users, "var(--teal)"], ["Reports", data.totals.reports, "var(--purple)"], ["Searches", data.totals.searches, "var(--green)"]].map(([label, val, c]) => (
          <div key={label} className="card card-orb p-4 text-center">
            <div className="font-display text-3xl font-bold" style={{ color: c }}>{val}</div>
            <div className="eyebrow mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* role breakdown */}
      <div>
        <div className="eyebrow mb-2">Roles</div>
        <div className="flex gap-2">
          {Object.entries(data.roleBreakdown).map(([role, n]) => (
            <span key={role} className="pill-tag" style={{ background: "var(--surface-2)", color: role === "admin" ? "var(--red)" : role === "manager" ? "var(--purple)" : "var(--ink-soft)" }}>
              {role}: {n}
            </span>
          ))}
        </div>
      </div>

      {/* usage by day */}
      {data.usageByDay.length > 0 && (
        <div>
          <div className="eyebrow mb-2">Searches (last {data.usageByDay.length} days)</div>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {data.usageByDay.map((d) => (
              <div key={d.day} className="flex-1 rounded-t" title={`${d.day}: ${d.count}`}
                style={{ height: `${(d.count / maxDay) * 100}%`, background: "var(--teal)", minHeight: 2 }} />
            ))}
          </div>
        </div>
      )}

      {/* top companies + top users */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Top Companies</div>
          <div className="space-y-1">
            {data.topCompanies.length === 0 && <p className="text-xs ink-faint">No data yet.</p>}
            {data.topCompanies.map((c) => (
              <div key={c.company} className="flex justify-between text-sm">
                <span className="truncate ink-soft">{c.company}</span>
                <span className="font-mono ink-faint">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-2">Most Active</div>
          <div className="space-y-1">
            {data.topUsers.length === 0 && <p className="text-xs ink-faint">No data yet.</p>}
            {data.topUsers.map((u) => (
              <div key={u.email} className="flex justify-between text-sm">
                <span className="truncate ink-soft">{u.email}</span>
                <span className="font-mono ink-faint">{u.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
