import { useState, useCallback, useEffect } from "react";

// Tracks the user's daily report usage (used / limit). Reads from the backend
// check-limit endpoint, which is the single source of truth. `refresh` fetches
// current counts; `applyResult` updates from a check-limit response after a run.
export function useUsage(session, authed) {
  const [usage, setUsage] = useState(null); // { used, limit } | null
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!authed || !session?.access_token) { setUsage(null); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/check-limit?peek=1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (resp.ok && typeof data.used === "number") {
        setUsage({ used: data.used, limit: data.limit });
      }
    } catch {
      /* leave usage as-is on network error */
    } finally {
      setLoading(false);
    }
  }, [authed, session]);

  // Fetch once when the user becomes authenticated.
  useEffect(() => { refresh(); }, [refresh]);

  // Apply a check-limit response (after a generation) directly.
  const applyResult = useCallback((data) => {
    if (data && typeof data.used === "number") setUsage({ used: data.used, limit: data.limit });
  }, []);

  const remaining = usage ? Math.max(0, usage.limit - usage.used) : null;

  return { usage, remaining, loading, refresh, applyResult };
}