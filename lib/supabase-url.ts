/**
 * Normalises SUPABASE_URL to the bare project URL (https://<ref>.supabase.co).
 * The dashboard also shows the REST endpoint (…/rest/v1/), and pasting that one makes
 * supabase-js call /rest/v1/rest/v1/… which fails without a clear error.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("SUPABASE_URL must start with https://");
  }
  const path = url.pathname.replace(/\/+$/, "").replace(/\/(rest|storage|auth)\/v1$/, "");
  if (path !== "") {
    throw new Error(`SUPABASE_URL should be just the project URL, like https://<ref>.supabase.co (got path "${url.pathname}")`);
  }
  return url.origin;
}
