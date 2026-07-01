// Elevated-only: list all users with their roles and basic stats.
// Server-side role check — a regular user gets 403 even calling directly.
//
// GET with Authorization: Bearer <token>
// → { users: [{ id, email, role, created_at, report_count, searches_today }] }

import { createClient } from "@supabase/supabase-js";
import { authorize } from "./_role.js";

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const todayKey = () => new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const auth = await authorize(req, { requireElevated: true });
  if (!auth.ok) {
    res.statusCode = auth.reason === "unauthenticated" ? 401 : 403;
    res.end(JSON.stringify({ error: auth.reason === "unauthenticated" ? "Not authenticated." : "Forbidden." }));
    return;
  }

  try {
    const admin = adminClient();
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) { res.statusCode = 500; res.end(JSON.stringify({ error: "Failed to load users." })); return; }

    const ids = (profiles || []).map((p) => p.id);
    // Report counts per user.
    const reportCount = {};
    const searchesToday = {};
    if (ids.length) {
      const { data: reports } = await admin.from("reports").select("user_id").in("user_id", ids);
      (reports || []).forEach((r) => { reportCount[r.user_id] = (reportCount[r.user_id] || 0) + 1; });
      const { data: usage } = await admin.from("usage").select("user_id, count").eq("day", todayKey()).in("user_id", ids);
      (usage || []).forEach((u) => { searchesToday[u.user_id] = u.count; });
    }

    const users = (profiles || []).map((p) => ({
      id: p.id,
      email: p.email || "unknown",
      role: p.role || "user",
      created_at: p.created_at,
      report_count: reportCount[p.id] || 0,
      searches_today: searchesToday[p.id] || 0,
      is_self: p.id === auth.userId,
    }));

    res.statusCode = 200;
    res.end(JSON.stringify({ users, myRole: auth.role }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Server error." }));
  }
}
