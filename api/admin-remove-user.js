// Elevated-only: remove (delete) a user. Server-side guarded. DESTRUCTIVE.
//
// POST { userId } with Authorization: Bearer <token>
// Guards:
//   - caller must be elevated
//   - cannot delete YOURSELF (prevents accidental self-lockout)
//   - cannot delete the last admin
// Deletes the auth user; profiles/reports/usage rows cascade via FK
// (on delete cascade), so the user's data is cleaned up too.

import { createClient } from "@supabase/supabase-js";
import { authorize, ROLES } from "./_role.js";

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed." })); return; }

  const auth = await authorize(req, { requireElevated: true });
  if (!auth.ok) {
    res.statusCode = auth.reason === "unauthenticated" ? 401 : 403;
    res.end(JSON.stringify({ error: auth.reason === "unauthenticated" ? "Not authenticated." : "Forbidden." }));
    return;
  }

  const { userId } = req.body || {};
  if (!userId) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing userId." })); return; }

  // Guard: never delete yourself.
  if (userId === auth.userId) {
    res.statusCode = 409;
    res.end(JSON.stringify({ error: "You can't remove your own account here." }));
    return;
  }

  try {
    const admin = adminClient();

    // Guard: don't delete the last admin.
    const { data: target } = await admin.from("profiles").select("role").eq("id", userId).limit(1);
    if (target && target.length && target[0].role === ROLES.ADMIN) {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", ROLES.ADMIN);
      if ((admins || []).length <= 1) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: "Cannot remove the last admin." }));
        return;
      }
    }

    // Delete the auth user (cascades to profiles/reports/usage via FK).
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) { res.statusCode = 500; res.end(JSON.stringify({ error: "Failed to remove user." })); return; }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, userId }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Server error." }));
  }
}
