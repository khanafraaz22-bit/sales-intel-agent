// Enforces the per-user daily report limit (5/day) using Supabase.
// Called by the frontend BEFORE starting a generation. Verifies the user's
// access token, checks/increments their usage for today, and returns whether
// they're allowed. Uses the SERVICE ROLE key (server-side only).

import { createClient } from "@supabase/supabase-js";

const DAILY_LIMIT = parseInt(process.env.DAILY_REPORT_LIMIT || "5", 10);

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Server auth not configured." }));
    return;
  }

  // Bearer token from the logged-in user
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated." })); return; }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Validate the token → get the user
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.statusCode = 401; res.end(JSON.stringify({ error: "Invalid session." })); return;
  }
  const user = userData.user;
  if (!user.email_confirmed_at && !user.confirmed_at) {
    res.statusCode = 403; res.end(JSON.stringify({ error: "Email not verified." })); return;
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Read today's row
  const { data: rows } = await admin
    .from("usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("day", today)
    .limit(1);

  const current = rows?.[0]?.count ?? 0;

  // Peek mode: just report current usage without consuming one.
  const isPeek = (req.query && req.query.peek) || /[?&]peek=1/.test(req.url || "");
  if (isPeek) {
    res.statusCode = 200;
    res.end(JSON.stringify({ allowed: current < DAILY_LIMIT, used: current, limit: DAILY_LIMIT, peek: true }));
    return;
  }

  if (current >= DAILY_LIMIT) {
    res.statusCode = 200;
    res.end(JSON.stringify({ allowed: false, used: current, limit: DAILY_LIMIT }));
    return;
  }

  // Increment (upsert today's row)
  const { error: upErr } = await admin
    .from("usage")
    .upsert(
      { user_id: user.id, email: user.email, day: today, count: current + 1 },
      { onConflict: "user_id,day" }
    );
  if (upErr) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Could not record usage." })); return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ allowed: true, used: current + 1, limit: DAILY_LIMIT }));
}