// Read-only daily usage peek for the header pill ("X of 5 left").
// Authoritative count comes from the service-key helper; the client only reads.
//
// GET/POST with Authorization: Bearer <supabase access token>
// → { used, limit, remaining, configured }

import { getUserId, peekUsage, isLimitConfigured } from "./_limit.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (!isLimitConfigured()) {
    // No server-side limit configured → report "disabled" so the UI hides the pill.
    res.statusCode = 200;
    res.end(JSON.stringify({ configured: false, used: 0, limit: 0, remaining: 0 }));
    return;
  }

  const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  const userId = await getUserId(token);
  if (!userId) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Not authenticated." }));
    return;
  }

  const usage = await peekUsage(userId);
  res.statusCode = 200;
  res.end(JSON.stringify({ configured: true, ...usage }));
}
