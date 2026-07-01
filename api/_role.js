// Server-side ROLE resolution (authoritative, can't be bypassed).
//
// Roles: 'admin', 'manager', 'user'. Admin and manager are ELEVATED (identical
// privileges); user is the default. The role lives in the `profiles` table,
// keyed by the auth user id. It is ALWAYS read server-side from the validated
// bearer token — never trusted from the client — so hiding UI is only cosmetic
// and the real gate is here.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// If Supabase isn't configured, everyone resolves to 'user' (no elevation),
// matching the app's graceful-degradation pattern.

import { createClient } from "@supabase/supabase-js";

export const ROLES = { ADMIN: "admin", MANAGER: "manager", USER: "user" };
const ELEVATED = new Set([ROLES.ADMIN, ROLES.MANAGER]);

export function isRoleConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || "").trim() &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  );
}

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Resolve the authenticated user id from a bearer token, or null.
export async function getUserId(token) {
  if (!token) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// Resolve a user's role from their profile row. Defaults to 'user' if there's
// no row yet (e.g. brand-new signup before the profile trigger runs) or if
// Supabase isn't configured. Never throws to the caller.
export async function getRoleForUser(userId) {
  if (!userId || !isRoleConfigured()) return ROLES.USER;
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .limit(1);
    if (error || !data || !data.length) return ROLES.USER;
    const role = String(data[0].role || "").toLowerCase();
    return [ROLES.ADMIN, ROLES.MANAGER, ROLES.USER].includes(role) ? role : ROLES.USER;
  } catch {
    return ROLES.USER;
  }
}

// Convenience: resolve role directly from a bearer token.
export async function getRoleFromToken(token) {
  const userId = await getUserId(token);
  return getRoleForUser(userId);
}

export function isElevated(role) {
  return ELEVATED.has(role);
}

// Admin is strictly above manager. Used to gate user-management actions.
export function isAdmin(role) {
  return role === ROLES.ADMIN;
}

// Per-role daily search limit: admin 10, manager 7, user 5 (env-overridable).
export function limitForRole(role) {
  if (role === ROLES.ADMIN) return parseInt(process.env.ADMIN_REPORT_LIMIT || "10", 10);
  if (role === ROLES.MANAGER) return parseInt(process.env.MANAGER_REPORT_LIMIT || "7", 10);
  return parseInt(process.env.DAILY_REPORT_LIMIT || "5", 10);
}

// Guard helper for endpoints: returns { ok, userId, role } after validating the
// token. Options:
//   requireElevated → admin OR manager (shared privileges: analytics, all-reports, config)
//   requireAdmin    → admin ONLY (user management)
export async function authorize(req, { requireElevated = false, requireAdmin = false } = {}) {
  const token = (req.headers?.["authorization"] || "").replace(/^Bearer\s+/i, "");
  const userId = await getUserId(token);
  if (!userId) return { ok: false, reason: "unauthenticated", userId: null, role: null };
  const role = await getRoleForUser(userId);
  if (requireAdmin && !isAdmin(role)) {
    return { ok: false, reason: "forbidden", userId, role };
  }
  if (requireElevated && !isElevated(role)) {
    return { ok: false, reason: "forbidden", userId, role };
  }
  return { ok: true, userId, role };
}
