// Elevated-only: change a user's role. Server-side guarded.
//
// POST { userId, role } with Authorization: Bearer <token>
// Guards:
//   - caller must be elevated (admin/manager)
//   - target role must be valid
//   - cannot demote the LAST admin (prevents locking everyone out)
//   - changing your own role is allowed EXCEPT demoting the last admin

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

  const auth = await authorize(req, { requireAdmin: true });
  if (!auth.ok) {
    res.statusCode = auth.reason === "unauthenticated" ? 401 : 403;
    res.end(JSON.stringify({ error: auth.reason === "unauthenticated" ? "Not authenticated." : "Forbidden." }));
    return;
  }

  const { userId, role } = req.body || {};
  const validRoles = [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER];
  if (!userId || !validRoles.includes(role)) {
    res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid userId or role." })); return;
  }

  try {
    const admin = adminClient();

    // Guard: don't allow removing the last admin (by demoting them).
    if (role !== ROLES.ADMIN) {
      const { data: target } = await admin.from("profiles").select("role").eq("id", userId).limit(1);
      const targetIsAdmin = target && target.length && target[0].role === ROLES.ADMIN;
      if (targetIsAdmin) {
        const { data: admins } = await admin.from("profiles").select("id").eq("role", ROLES.ADMIN);
        if ((admins || []).length <= 1) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: "Cannot demote the last admin. Promote another admin first." }));
          return;
        }
      }
    }

    const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
    if (error) { res.statusCode = 500; res.end(JSON.stringify({ error: "Failed to update role." })); return; }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, userId, role }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Server error." }));
  }
}
