// Behavioural security check: acts like a browser holding the PUBLIC (publishable) key and tries to
// read and write every table and the evidence bucket. Every attempt must fail.
// Usage: add SUPABASE_PUBLISHABLE_KEY to .env.local (Project Settings → API Keys), then
//   npx tsx scripts/check-rls.ts   (or npm run rls:check)
// The app itself never uses this key; it exists only for this test.
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../lib/supabase-url";

const TABLES = ["areas", "places", "fare_benchmarks", "reports", "report_votes", "fare_checks"];

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // use the environment as is
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (the public key, not the secret one) in .env.local.");
    process.exit(1);
  }
  if (key.startsWith("sb_secret_")) {
    console.error("That's the secret key. This check needs the publishable key.");
    process.exit(1);
  }

  const anon = createClient(normalizeSupabaseUrl(url), key, { auth: { persistSession: false } });
  let failures = 0;
  const result = (ok: boolean, what: string, detail: string) => {
    if (!ok) failures++;
    console.log(`${ok ? "blocked" : "EXPOSED"}  ${what.padEnd(34)} ${detail}`);
  };

  for (const table of TABLES) {
    const read = await anon.from(table).select("*").limit(1);
    // Blocked = an error (no grant) or, if a grant ever reappears, RLS returning no rows.
    result(!!read.error || (read.data?.length ?? 0) === 0, `read ${table}`, read.error ? `(${read.error.code ?? read.error.message})` : `(${read.data?.length ?? 0} rows)`);
  }

  const write = await anon.from("reports").insert({
    device_id: "00000000-0000-4000-8000-000000000000",
    service_type: "auto",
    pickup_lat: 26.18,
    pickup_lng: 91.75,
    drop_lat: 26.17,
    drop_lng: 91.7,
    distance_km: 5,
    paid_price: 1,
    is_scam: false,
  });
  result(!!write.error, "insert into reports", write.error ? `(${write.error.code ?? write.error.message})` : "(insert succeeded!)");

  const list = await anon.storage.from("evidence").list();
  result(!!list.error || (list.data?.length ?? 0) === 0, "list evidence bucket", list.error ? `(${list.error.message})` : `(${list.data?.length ?? 0} files)`);

  const upload = await anon.storage.from("evidence").upload(`rls-check-${Date.now()}.jpg`, new Blob(["x"], { type: "image/jpeg" }));
  result(!!upload.error, "upload to evidence bucket", upload.error ? `(${upload.error.message})` : "(upload succeeded!)");

  const publicUrl = anon.storage.from("evidence").getPublicUrl("anything.jpg").data.publicUrl;
  const pub = await fetch(publicUrl);
  result(!pub.ok, "public URL of an evidence photo", `(HTTP ${pub.status})`);

  console.log(failures ? `\n${failures} check(s) FAILED: data is reachable with the public key.` : "\nAll blocked: the public key can't read or write anything.");
  process.exit(failures ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
