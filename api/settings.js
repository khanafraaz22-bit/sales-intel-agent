// App settings: the admin-editable InfraBeat positioning text and section-title
// overrides. GET is readable by any authenticated user (generation needs it);
// POST requires an elevated role and is enforced server-side.
//
// GET  → { infrabeat_text, title_overrides }
// POST { infrabeat_text?, title_overrides? } (elevated only)

import { createClient } from "@supabase/supabase-js";
import { authorize } from "./_role.js";

function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isConfigured() {
  return Boolean((process.env.SUPABASE_URL || "").trim() && (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (!isConfigured()) {
    res.statusCode = 200;
    res.end(JSON.stringify({ infrabeat_text: null, title_overrides: {} }));
    return;
  }

  const admin = adminClient();

  if (req.method === "GET") {
    // Any authenticated user may read (validate token but don't require elevated).
    const auth = await authorize(req);
    if (!auth.ok) {
      // Unauthenticated → return empty defaults (generation still works).
      res.statusCode = 200;
      res.end(JSON.stringify({ infrabeat_text: null, title_overrides: {} }));
      return;
    }
    const { data } = await admin.from("app_settings").select("infrabeat_text, title_overrides").eq("id", 1).limit(1);
    const row = data && data.length ? data[0] : { infrabeat_text: null, title_overrides: {} };
    res.statusCode = 200;
    res.end(JSON.stringify(row));
    return;
  }

  if (req.method === "POST") {
    const auth = await authorize(req, { requireElevated: true });
    if (!auth.ok) {
      res.statusCode = auth.reason === "unauthenticated" ? 401 : 403;
      res.end(JSON.stringify({ error: auth.reason === "unauthenticated" ? "Not authenticated." : "Forbidden." }));
      return;
    }
    const { infrabeat_text, title_overrides } = req.body || {};
    const patch = { id: 1, updated_at: new Date().toISOString() };
    if (typeof infrabeat_text === "string") patch.infrabeat_text = infrabeat_text.slice(0, 4000);
    if (title_overrides && typeof title_overrides === "object") {
      // Sanitize: keys are section numbers, values are short strings.
      const clean = {};
      for (const [k, v] of Object.entries(title_overrides)) {
        if (/^\d{1,2}$/.test(k) && typeof v === "string" && v.trim()) clean[k] = v.trim().slice(0, 120);
      }
      patch.title_overrides = clean;
    }
    const { error } = await admin.from("app_settings").upsert(patch, { onConflict: "id" });
    if (error) { res.statusCode = 500; res.end(JSON.stringify({ error: "Failed to save settings." })); return; }
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: "Method not allowed." }));
}
