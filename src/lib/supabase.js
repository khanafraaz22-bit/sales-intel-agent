import { createClient } from "@supabase/supabase-js";

// Frontend Supabase client. Uses the PUBLIC anon key — safe to expose.
// These come from .env.local (Vite exposes VITE_ vars to the browser):
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If not configured, we export null so the app can show a clear setup message
// rather than crashing.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const isSupabaseConfigured = Boolean(url && anonKey);
