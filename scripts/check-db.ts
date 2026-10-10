// Prints row counts per table and checks the seed landed correctly.
// Usage: npx tsx scripts/check-db.ts   (or: npm run db:check)
// Reads SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
//
// Creates its own client instead of importing lib/supabase-server.ts, because the
// `server-only` guard in that file throws outside Next.js.
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../lib/supabase-url";

const EXPECTED: Record<string, { seed: number; exact: boolean }> = {
  areas: { seed: 5, exact: true },
  places: { seed: 28, exact: true },
  fare_benchmarks: { seed: 30, exact: true },
  reports: { seed: 100, exact: false }, // 100 seed reports + whatever users have added
  report_votes: { seed: 0, exact: false },
  fare_checks: { seed: 0, exact: false },
  fixed_fares: { seed: 94, exact: true }, // supabase/seed-fixed-fares.sql
};

const HOTSPOTS = ["Guwahati Railway Station", "LGBI Airport (Terminal 1)"];
const ESCALATION = { radiusM: 500, days: 90, minReports: 3, minDevices: 3 };

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Fall back to variables already in the environment.
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.");
    process.exit(1);
  }

  let projectUrl: string;
  try {
    projectUrl = normalizeSupabaseUrl(url);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
  if (projectUrl !== url.trim().replace(/\/+$/, "")) {
    console.log(`Note: SUPABASE_URL should be just ${projectUrl} (without /rest/v1). Using that.\n`);
  }

  const db = createClient(projectUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let problems = 0;

  console.log(`Supabase: ${new URL(projectUrl).host}\n`);
  console.log("table              rows   expected   status");
  console.log("-----------------  -----  ---------  ------");
  for (const [table, exp] of Object.entries(EXPECTED)) {
    // HEAD requests carry no error body, so a failure can show up only as a null count.
    const { count, error, status } = await db.from(table).select("*", { count: "exact", head: true });
    if (error || count === null) {
      problems++;
      const message = error?.message || `HTTP ${status}, no count returned`;
      const hint =
        status === 404 || /could not find|does not exist/i.test(message)
          ? " (table missing: run 001_init.sql, or check SUPABASE_URL)"
          : status === 401 || status === 403
            ? " (check SUPABASE_SECRET_KEY, and that 001_init.sql granted service_role)"
            : "";
      console.log(`${table.padEnd(17)}  ERROR  ${message}${hint}`);
      continue;
    }
    const n = count;
    const ok = exp.exact ? n === exp.seed : n >= exp.seed;
    if (!ok) problems++;
    const expected = exp.exact ? `${exp.seed}` : `>= ${exp.seed}`;
    console.log(`${table.padEnd(17)}  ${String(n).padStart(5)}  ${expected.padStart(9)}  ${ok ? "ok" : "MISMATCH"}`);
  }

  const seed = await db.from("reports").select("is_scam").eq("is_seed", true);
  if (!seed.error) {
    const scams = seed.data.filter((r) => r.is_scam).length;
    const ok = seed.data.length === 100 && scams === 30;
    if (!ok) problems++;
    console.log(`\nseed reports: ${seed.data.length} (${scams} scams, expected 100 / 30) ${ok ? "ok" : "MISMATCH"}`);
  }

  const bucket = await db.storage.getBucket("evidence");
  if (bucket.error) {
    problems++;
    console.log(`storage bucket 'evidence': MISSING (${bucket.error.message})`);
  } else {
    const ok = bucket.data.public === false;
    if (!ok) problems++;
    console.log(`storage bucket 'evidence': ${bucket.data.public ? "PUBLIC (should be private!)" : "private, ok"}`);
  }

  // Same rule as the scoring engine: >= 3 scam reports from >= 3 devices within 500 m in 90 days.
  const since = new Date(Date.now() - ESCALATION.days * 86_400_000).toISOString();
  const [places, scams] = await Promise.all([
    db.from("places").select("name, lat, lng").in("name", HOTSPOTS),
    db.from("reports").select("device_id, pickup_lat, pickup_lng").eq("is_scam", true).gte("created_at", since),
  ]);
  if (!places.error && !scams.error) {
    console.log("");
    for (const p of places.data) {
      const near = scams.data.filter((r) => haversineM(p.lat, p.lng, r.pickup_lat, r.pickup_lng) <= ESCALATION.radiusM);
      const devices = new Set(near.map((r) => r.device_id)).size;
      const ok = near.length >= ESCALATION.minReports && devices >= ESCALATION.minDevices;
      if (!ok) problems++;
      console.log(`hotspot ${p.name}: ${near.length} scams from ${devices} devices (last 90 days) ${ok ? "ok, will escalate" : "TOO FEW"}`);
    }
  }

  console.log(problems ? `\n${problems} problem(s) found.` : "\nAll checks passed.");
  process.exit(problems ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
