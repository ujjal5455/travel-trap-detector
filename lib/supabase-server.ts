// Server-only Supabase client using the secret (service role) key.
// `server-only` makes the build fail if a client component imports this file;
// the window check is a second guard at runtime.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "./supabase-url";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase-server.ts must never be imported in the browser.");
}

let client: SupabaseClient | null = null;

/** Lazily created so builds and tests don't need the env vars until a query runs. */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set. See .env.example.");
  }

  client = createClient(normalizeSupabaseUrl(url), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
