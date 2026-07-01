import { useState, useEffect, useCallback } from "react";

// Reads the current user's role from the server (authoritative). Used to decide
// whether to show elevated (admin/manager) surfaces. IMPORTANT: this is for UI
// only — every privileged action is re-checked server-side, so a tampered
// response grants nothing. Defaults to a non-elevated 'user'.
export function useRole(session, authed) {
  const [role, setRole] = useState("user");
  const [elevated, setElevated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const token = session?.access_token;
    if (!authed || !token) { setRole("user"); setElevated(false); setLoaded(true); return; }
    try {
      const resp = await fetch("/api/my-role", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setRole(data.role || "user");
        setElevated(Boolean(data.elevated));
      }
    } catch {
      setRole("user"); setElevated(false);
    } finally {
      setLoaded(true);
    }
  }, [session, authed]);

  useEffect(() => { refresh(); }, [refresh]);

  return { role, elevated, loaded, refresh };
}
