import { useState, useCallback, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";

// Per-user report history backed by the Supabase `reports` table. RLS ensures
// each user only sees their own rows, so we use the normal (anon + session)
// client — no service key on the frontend.
export function useHistory(authed) {
  const [items, setItems] = useState([]); // [{ id, company, blocks, created_at }]
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !authed) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("id, company, blocks, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && data) setItems(data);
    } finally {
      setLoading(false);
    }
  }, [authed]);

  useEffect(() => { load(); }, [load]);

  // Save a finished report. If this company already exists for the user, update
  // its blocks + timestamp (no duplicate). Otherwise insert a new row.
  const save = useCallback(async (company, blocks) => {
    if (!isSupabaseConfigured || !authed) return null;
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return null;

    const name = (company || "").trim();
    const now = new Date().toISOString();

    // Look for an existing entry for this company (case-insensitive).
    const { data: existing } = await supabase
      .from("reports")
      .select("id")
      .eq("user_id", user.id)
      .ilike("company", name)
      .limit(1);

    if (existing && existing.length) {
      // Update the existing row: refresh blocks + timestamp.
      const id = existing[0].id;
      const { data, error } = await supabase
        .from("reports")
        .update({ blocks, created_at: now })
        .eq("id", id)
        .select("id, company, blocks, created_at")
        .single();
      if (error || !data) return null;
      // Move it to the top of the local list.
      setItems((prev) => [data, ...prev.filter((r) => r.id !== id)]);
      return data;
    }

    // No existing entry — insert new.
    const { data, error } = await supabase
      .from("reports")
      .insert({ user_id: user.id, company: name, blocks })
      .select("id, company, blocks, created_at")
      .single();
    if (error || !data) return null;
    setItems((prev) => [data, ...prev]);
    return data;
  }, [authed]);

  // Just refresh an existing entry's timestamp (used when reopening from history).
  const touch = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const now = new Date().toISOString();
    // Optimistic: update the local list immediately and move to top.
    setItems((prev) => {
      const item = prev.find((r) => r.id === id);
      if (!item) return prev;
      return [{ ...item, created_at: now }, ...prev.filter((r) => r.id !== id)];
    });
    // Persist to the database.
    await supabase
      .from("reports")
      .update({ created_at: now })
      .eq("id", id);
  }, []);

  const remove = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    // optimistic
    setItems((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("reports").delete().eq("id", id);
  }, []);

  return { items, loading, load, save, touch, remove };
}