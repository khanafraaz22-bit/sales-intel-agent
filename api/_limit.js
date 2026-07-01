// Server-side daily search limit (authoritative, can't be bypassed).
//
// Counts ONE unit per new company that triggers a Brave search (section 1 with
// a successful search). Resuming from history or generating sections 2..11 does
// NOT count — those make no Brave call. Enforced with the Supabase SERVICE ROLE
// key against a `usage` table; the user is identified by validating their
// bearer token (never trusting a client-supplied id).
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// If Supabase isn't configured, the limit is treated as DISABLED (open) so the
// app still runs locally without auth — matching the existing graceful
// degradation pattern.

import { createClient } from "@supabase/supabase-js";
import { getRoleForUser, isElevated } from "./_role.js";

const DAILY_LIMIT = parseInt(process.env.DAILY_REPORT_LIMIT || "5", 10);
const ELEVATED_LIMIT = parseInt(process.env.ELEVATED_REPORT_LIMIT || "10", 10);

// The daily limit for a given role: elevated (admin/manager) → 10, else 5.
function limitForRole(role) {
  return isElevated(role) ? ELEVATED_LIMIT : DAILY_LIMIT;
}

export function isLimitConfigured() {
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

// UTC day key (matches the original design: resets at midnight UTC = 5:30 IST).
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Resolve the authenticated user id from a bearer token. Returns null if the
// token is missing/invalid (caller decides how to handle).
export async function getUserId(token) {
  if (!token) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// Read the user's current usage for today. Returns { used, limit, remaining }.
// The limit reflects the user's role (elevated → higher).
export async function peekUsage(userId) {
  if (!userId) return { used: 0, limit: DAILY_LIMIT, remaining: DAILY_LIMIT };
  const role = await getRoleForUser(userId);
  const limit = limitForRole(role);
  const admin = adminClient();
  const day = todayKey();
  const { data } = await admin
    .from("usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", day)
    .limit(1);
  const used = data && data.length ? data[0].count : 0;
  return { used, limit, remaining: Math.max(0, limit - used), role };
}

// Check whether the user may start a new company search today (does NOT
// increment). Returns { allowed, used, limit, remaining }.
export async function checkLimit(userId) {
  const { used, limit, remaining, role } = await peekUsage(userId);
  return { allowed: remaining > 0, used, limit, remaining, role };
}

// Commit one unit (call ONLY after a successful Brave search on section 1).
// Uses an upsert-style increment. Returns the new usage.
export async function commitUsage(userId) {
  if (!userId) return { used: 0, limit: DAILY_LIMIT, remaining: DAILY_LIMIT };
  const role = await getRoleForUser(userId);
  const limit = limitForRole(role);
  const admin = adminClient();
  const day = todayKey();

  // Read current, then upsert count+1. (Last-write-wins is acceptable here; the
  // limit is a soft cost-guard, not a hard financial control.)
  const { data: existing } = await admin
    .from("usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", day)
    .limit(1);

  const current = existing && existing.length ? existing[0].count : 0;
  const next = current + 1;

  await admin
    .from("usage")
    .upsert({ user_id: userId, day, count: next }, { onConflict: "user_id,day" });

  return { used: next, limit, remaining: Math.max(0, limit - next), role };
}
