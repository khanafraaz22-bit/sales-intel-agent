// Elevated-only: aggregate analytics for the admin dashboard.
//
// GET with Authorization: Bearer <token>
// → { totals, roleBreakdown, topCompanies, usageByDay, topUsers }

import { createClient } from "@supabase/supabase-js";
import { authorize } from "./_role.js";

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
    const [{ data: profiles }, { data: reports }, { data: usage }] = await Promise.all([
      admin.from("profiles").select("id, email, role"),
      admin.from("reports").select("company, user_id, created_at"),
      admin.from("usage").select("user_id, day, count"),
    ]);

    const totalUsers = (profiles || []).length;
    const totalReports = (reports || []).length;
    const totalSearches = (usage || []).reduce((s, u) => s + (u.count || 0), 0);

    // Role breakdown.
    const roleBreakdown = { admin: 0, manager: 0, user: 0 };
    (profiles || []).forEach((p) => { roleBreakdown[p.role || "user"] = (roleBreakdown[p.role || "user"] || 0) + 1; });

    // Top companies searched (by report count).
    const compCount = {};
    (reports || []).forEach((r) => { const c = (r.company || "").trim(); if (c) compCount[c] = (compCount[c] || 0) + 1; });
    const topCompanies = Object.entries(compCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([company, count]) => ({ company, count }));

    // Searches by day (last 14 days), summed across users.
    const byDay = {};
    (usage || []).forEach((u) => { byDay[u.day] = (byDay[u.day] || 0) + (u.count || 0); });
    const usageByDay = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
      .map(([day, count]) => ({ day, count }));

    // Top users by report count.
    const emailById = Object.fromEntries((profiles || []).map((p) => [p.id, p.email || "unknown"]));
    const userReports = {};
    (reports || []).forEach((r) => { userReports[r.user_id] = (userReports[r.user_id] || 0) + 1; });
    const topUsers = Object.entries(userReports)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([id, count]) => ({ email: emailById[id] || "unknown", count }));

    res.statusCode = 200;
    res.end(JSON.stringify({
      totals: { users: totalUsers, reports: totalReports, searches: totalSearches },
      roleBreakdown, topCompanies, usageByDay, topUsers,
    }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Server error." }));
  }
}
