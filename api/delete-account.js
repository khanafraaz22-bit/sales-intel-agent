// Deletes the authenticated user's account (and cascades their data via FK).
// Requires the SERVICE ROLE key. The frontend re-verifies the user's password
// before calling this, and we re-validate the bearer token here.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Server auth not configured." })); return;
  }

  const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (!token) { res.statusCode = 401; res.end(JSON.stringify({ error: "Not authenticated." })); return; }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Validate the token → get the user id.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.statusCode = 401; res.end(JSON.stringify({ error: "Invalid session." })); return;
  }

  // Delete the auth user. usage + reports rows cascade via ON DELETE CASCADE.
  const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
  if (delErr) {
    res.statusCode = 500; res.end(JSON.stringify({ error: "Could not delete account." })); return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ deleted: true }));
}