// Elevated-only: return ALL users' reports (not just the caller's own).
// Enforced server-side — a non-elevated user gets 403 even if they call this
// endpoint directly, so this can't be bypassed by tampering with the UI.
//
// GET with Authorization: Bearer <token>
// → { reports: [{ id, company, blocks, brief, created_at, user_id, owner_email }] }

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
    // All reports (service key bypasses RLS). Join owner email from profiles.
    const { data: reports, error } = await admin
      .from("reports")
      .select("id, company, blocks, brief, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Failed to load reports." }));
      return;
    }

    // Attach owner emails for display.
    const ids = [...new Set((reports || []).map((r) => r.user_id).filter(Boolean))];
    let emailById = {};
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("id, email").in("id", ids);
      emailById = Object.fromEntries((profs || []).map((p) => [p.id, p.email]));
    }
    const withOwner = (reports || []).map((r) => ({ ...r, owner_email: emailById[r.user_id] || "unknown" }));

    res.statusCode = 200;
    res.end(JSON.stringify({ reports: withOwner }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Server error." }));
  }
}
