import { useState, useEffect, useCallback } from "react";

// Reads global app settings (InfraBeat positioning text + section-title
// overrides) so the generation flow can apply them. Any authenticated user
// reads; only elevated users can save (server-enforced).
export function useSettings(session, authed) {
  const [settings, setSettings] = useState({ infrabeat_text: null, title_overrides: {} });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const token = session?.access_token;
    if (!authed || !token) { setLoaded(true); return; }
    try {
      const r = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setSettings({ infrabeat_text: d.infrabeat_text || null, title_overrides: d.title_overrides || {} });
      }
    } catch { /* keep defaults */ } finally { setLoaded(true); }
  }, [session, authed]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (patch) => {
    const token = session?.access_token;
    if (!token) return { ok: false, error: "Not authenticated." };
    try {
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (!r.ok) return { ok: false, error: d.error || "Failed." };
      await refresh();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }, [session, refresh]);

  return { settings, loaded, refresh, save };
}
