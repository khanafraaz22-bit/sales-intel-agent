// Returns the current user's role, resolved server-side from their token.
// The frontend uses this to decide whether to show elevated surfaces. Because
// the real enforcement is server-side on each privileged endpoint, a user
// tampering with this response gains nothing.
//
// GET with Authorization: Bearer <supabase access token>
// → { role: 'admin'|'manager'|'user', elevated: boolean }

import { authorize, isElevated, ROLES } from "./_role.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const auth = await authorize(req);
  if (!auth.ok) {
    // Not signed in (or Supabase not configured) → default user, non-elevated.
    res.statusCode = 200;
    res.end(JSON.stringify({ role: ROLES.USER, elevated: false }));
    return;
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ role: auth.role, elevated: isElevated(auth.role) }));
}
