import { useState, useCallback, useEffect } from "react";

// Reads the user's daily search usage from the server (authoritative). The pill
// in the header shows remaining searches. `refresh()` re-fetches; call it after
// a new company search completes so the count updates live.
export function useUsage(session, authed) {
  const [usage, setUsage] = useState(null); // { used, limit, remaining } | null
  const [configured, setConfigured] = useState(false);

  const refresh = useCallback(async () => {
    const token = session?.access_token;
    if (!authed || !token) { setUsage(null); return; }
    try {
      const resp = await fetch("/api/check-limit", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setConfigured(Boolean(data.configured));
      if (data.configured) setUsage({ used: data.used, limit: data.limit, remaining: data.remaining });
      else setUsage(null);
    } catch {
      /* network error — leave previous state */
    }
  }, [session, authed]);

  useEffect(() => { refresh(); }, [refresh]);

  const remaining = usage ? usage.remaining : null;
  const limit = usage ? usage.limit : null;

  return { usage, remaining, limit, configured, refresh };
}
