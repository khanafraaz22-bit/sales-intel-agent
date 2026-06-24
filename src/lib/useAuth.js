import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";

// Manages auth state and exposes auth actions. A user must be logged in AND
// have a confirmed email to be considered authenticated for app use.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password, username, fullName) => {
    if (!supabase) return { error: { message: "Auth not configured." } };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: (username || "").trim(), full_name: (fullName || "").trim() },
      },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: { message: "Auth not configured." } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const resendVerification = useCallback(async (email) => {
    if (!supabase) return { error: { message: "Auth not configured." } };
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error };
  }, []);

  // ── Account management ──
  const updateUsername = useCallback(async (username) => {
    if (!supabase) return { error: { message: "Auth not configured." } };
    const { error } = await supabase.auth.updateUser({ data: { username: (username || "").trim() } });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    if (!supabase) return { error: { message: "Auth not configured." } };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  }, []);

  // Delete account: re-verify password first, then call the secure backend endpoint.
  const deleteAccount = useCallback(async (currentPassword) => {
    if (!supabase) return { error: { message: "Auth not configured." } };
    const email = session?.user?.email;
    if (!email) return { error: { message: "No active session." } };
    // Re-authenticate to confirm it's really them.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthErr) return { error: { message: "Password is incorrect." } };
    // Call backend to delete (needs service role).
    const token = session?.access_token;
    const resp = await fetch("/api/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      return { error: { message: d.error || "Could not delete account." } };
    }
    await supabase.auth.signOut();
    return { error: null };
  }, [session]);

  const user = session?.user ?? null;
  // Supabase sets email_confirmed_at once the user clicks the verify link.
  const emailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  const authed = Boolean(user && emailVerified);
  // Username from signup metadata; fall back to the local part of the email.
  const username = user?.user_metadata?.username?.trim() || (user?.email ? user.email.split("@")[0] : "");
  const fullName = user?.user_metadata?.full_name?.trim() || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : username;

  return {
    session, user, username, fullName, firstName, loading, authed, emailVerified,
    signUp, signIn, signOut, resendVerification,
    updateUsername, updatePassword, deleteAccount,
  };
}