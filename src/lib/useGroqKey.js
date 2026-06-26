import { useState, useEffect, useCallback } from "react";

// ── BYOK key storage (browser-side, per account) ────────────────
// The user's Groq API key lives ONLY in this browser's localStorage, namespaced
// to their account id (groq_key_<userId>). It is NEVER sent to or stored in our
// database. The agent endpoint receives it per-request and persists nothing.
//
// Tradeoff (intentional): the key is per-device. Signing in on another machine
// means re-entering the key there. This is the safe default — we never take
// custody of a user's secret credential.
//
// Security note for users: a key in the browser is readable by anyone with
// access to this device/browser. That's acceptable because it's the user's own
// key and their own device — the onboarding copy states this plainly.

const keyName = (userId) => `groq_key_${userId || "anon"}`;

function readKey(userId) {
  try {
    return localStorage.getItem(keyName(userId)) || "";
  } catch {
    return "";
  }
}

export function useGroqKey(userId) {
  const [groqKey, setGroqKeyState] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load whenever the account changes (sign in / out / switch user).
  useEffect(() => {
    setGroqKeyState(readKey(userId));
    setLoaded(true);
  }, [userId]);

  const setGroqKey = useCallback(
    (value) => {
      const v = (value || "").trim();
      setGroqKeyState(v);
      try {
        if (v) localStorage.setItem(keyName(userId), v);
        else localStorage.removeItem(keyName(userId));
      } catch {
        /* localStorage unavailable — key stays in memory for this session */
      }
    },
    [userId]
  );

  const clearGroqKey = useCallback(() => setGroqKey(""), [setGroqKey]);

  // hasKey: a usable key is present. Mirrors the backend's lenient length check.
  const hasKey = groqKey.trim().length >= 20;

  return { groqKey, hasKey, loaded, setGroqKey, clearGroqKey };
}
