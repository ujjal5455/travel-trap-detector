# Travel Trap Detector: Implementation Plan

Source of truth for the product spec is `docs/SPEC.md`. This file tracks how we build it and what is done.

Status legend: `[x]` done, `[ ]` to do. Each phase ends with: lint, typecheck, tests, update this file, commit `phase N: <summary>`.

---

## Decisions log

| # | Decision | Status |
|---|---|---|
| D1 | **LLM uses a free provider, not Anthropic.** `lib/explain.ts` calls any OpenAI-compatible chat-completions endpoint with plain `fetch` (no SDK). Env: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Provider: **Groq free tier** (`https://api.groq.com/openai/v1`, default model `llama-3.3-70b-versatile`, check against Groq's current list). Gemini or OpenRouter work with an env change only. Template fallback when no key, on timeout, or when the number guard fails. | **Agreed**, docs/SPEC.md updated |
| D2 | `fare_checks` gets `result jsonb` and `explanation text`. `/api/explain` takes a `checkId`, never client-supplied verdict JSON, so the client can't inject prompts or run up cost. | Proposed |
| D3 | Seed areas: Guwahati, Shillong, Sohra, Kaziranga, Tawang, Gangtok, plus regional defaults. All values are `demo_estimate` unless an official chart is supplied. | Proposed |
| D4 | Demo mode: `?demo=1` shows 3 scenario chips (FAIR, SUSPICIOUS, HIGH_RISK with community escalation at Guwahati Railway Station), a fixed trip time, and the ORS fallback forced. | Proposed |
| D5 | `report_votes` powers a "This happened to me too" button on map reports. The count is display-only and does not affect escalation. | Proposed |
| D6 | Offline: cached app shell plus a benchmark-only "Offline estimate" scored in the browser. No queue for offline reports unless requested. | Proposed |
| D7 | The driver-card lines in Assamese, Bengali and Hindi are first drafts and must be checked by a native speaker before the demo. | Open |
| D8 | Accounts needed: hosted Supabase project, ORS key, Vercel account, free LLM key. Migrations are run in the Supabase SQL editor (no Docker needed). | Open |
| D0 | **Zero spending.** Only free, no-card services: Supabase Free, Vercel Hobby, ORS free key, Groq free, Nominatim, OSM tiles. Every external dependency has a free fallback. | **Agreed**, in docs/SPEC.md |
| D9 | Area IDs are text slugs (`'guwahati'`), other IDs are UUIDs. Geo queries use a bounding box plus haversine in code, so no PostGIS. | Agreed |
| D10 | The night window is computed in `Asia/Kolkata`, because the server runs in UTC. | Agreed |
| D11 | Hand-written `public/sw.js` (next-pwa/Serwist don't fit Next 16 with Turbopack). Lint runs `eslint .` because `next lint` was removed in Next 16. | Agreed |

Versions at planning time (2026-10-10): Next 16.4, Tailwind 4.3, react-leaflet 5, @supabase/supabase-js 2.117, zod 4.6, Vitest 5.

---

## Folder structure

```
app/
  layout.tsx  globals.css  manifest.ts
  page.tsx                      Fare Check
  report/page.tsx  map/page.tsx  about/page.tsx
  api/
    places/route.ts             GET  ?q=        seeded places, then Nominatim
    fare-check/route.ts         POST            distance + scoring -> FareVerdict + checkId
    explain/route.ts            POST {checkId}  LLM or template explanation
    reports/route.ts            POST (multipart, optional photo) / GET recent
    reports/[id]/vote/route.ts  POST
    hotspots/route.ts           GET
    offline-pack/route.ts       GET             areas + places + benchmarks
components/
  ui/  fare-check/  verdict/  map/  report/  driver/
lib/                            pure, unit-tested, no I/O
  config.ts types.ts validation.ts scoring.ts geo.ts time.ts format.ts
  distance.ts places.ts nominatim.ts explain.ts explain-template.ts number-guard.ts
  hotspots.ts rate-limit.ts driver-lines.ts
  supabase-server.ts              server-only Supabase client
  server/   repo.ts device.ts               ('server-only')
  client/   device-id.ts api.ts offline-store.ts
tests/                          *.test.ts
supabase/migrations/0001_init.sql
scripts/seed.ts                 idempotent upsert (npm run seed)
data/seed/                      areas.ts places.ts benchmarks.ts reports.ts
public/                         sw.js, icons
docs/PLAN.md  docs/DEMO.md
.env.example  README.md  vitest.config.mts
```

---

## Phase checklist

### Phase 0: Planning
- [x] Read docs/SPEC.md, draft plan, schema, risks
- [x] Plan approved and saved to `docs/PLAN.md`
- [x] D1: free LLM provider chosen (Groq)
- [ ] Resolve open decisions D2 to D8

### Phase 1: Scaffold
- [x] `git init`
- [x] create-next-app (TS, Tailwind, ESLint, App Router, no `src/`) in a temp dir, then move it in (the target dir is non-empty)
- [x] Scripts: `lint` (`eslint .`), `typecheck` (`next typegen && tsc --noEmit`), `test` (`vitest run`), `check` (all three)
- [x] `vitest.config.mts`, `.env.example` (un-ignored), `.env*` gitignored
- [x] `app/layout.tsx` with bottom nav, placeholder pages: `/`, `/report`, `/map`, `/about`
- [x] `lib/config.ts` (all thresholds), `lib/types.ts` (FareVerdict etc.), `lib/format.ts` + tests
- [x] README stub
- [x] Lint, typecheck, tests, build green; checked at 375 px. Commit `phase 1: scaffold`
- [x] Fix-up: installed `@supabase/supabase-js`, `leaflet`, `react-leaflet`, `server-only`, dev `@types/leaflet`, `tsx` (no `@anthropic-ai/sdk`: Groq via fetch)
- [x] Fix-up: `lib/supabase-server.ts` (server-only, lazy client, throws in the browser or without env vars)
- [x] Fix-up: row types for all six tables in `lib/types.ts`
- [x] Fix-up: top bar with the app name; nav labels Check / Report / Map / About
- [x] Fix-up: `lib/client/device-id.ts` (UUID in localStorage, with fallbacks for insecure contexts and blocked storage) + `lib/client/api.ts` (`x-device-id` fetch wrapper) + tests
- [x] Fix-up: plain `npx tsc --noEmit` passes on a fresh clone. Commit `phase 1: complete scaffold`

Phase 1 notes:
- create-next-app now enables Cache Components and Partial Prefetching by default. Kept both. Static pages need nothing extra; API `GET` handlers follow the prerender model, so phases 3 and 8 must keep them dynamic.
- Next 16 ships its own docs in `node_modules/next/dist/docs/`, and `AGENTS.md` points agents there. `LayoutProps` and similar types are generated by `next typegen`.
- `@types/node` bumped to ^24 because Vitest 5 requires it.
- `npm audit` flags 5 high-severity issues, all in ESLint dev tooling (`braces` via `eslint-config-next`). None of it ships to users, and the `--force` fix would downgrade the Next ESLint config, so it is left as is.
- The dev indicator was moved to the top right so it doesn't cover the bottom nav.

### Phase 2: Database and seed
- [ ] `supabase/migrations/0001_init.sql` (schema below, RLS, private `evidence` bucket)
- [ ] `data/seed/areas.ts`, `places.ts`, `benchmarks.ts` (`demo_estimate`, "Replace with official fare chart"), `reports.ts` (`is_seed = true`, dates relative to now, distinct device IDs for the escalation demo)
- [ ] `scripts/seed.ts` (idempotent), `npm run seed`
- [ ] `lib/server/repo.ts` (typed queries on top of `lib/supabase-server.ts`, which exists already)
- [ ] Migration applied and seed run against the hosted project
- [ ] Commit `phase 2: database and seed`

### Phase 3: Places and distance
- [ ] `lib/geo.ts`: haversine, bounding box, `findArea` (point in area radius) + tests
- [ ] `lib/distance.ts`: ORS driving-car, 3 s timeout, haversine x 1.3 fallback, returns method, caches by rounded coords + tests
- [ ] `lib/nominatim.ts`: custom User-Agent, NE India viewbox, `countrycodes=in`, 1 req/s throttle, cache
- [ ] `lib/places.ts`: merge seeded matches first, then Nominatim + tests
- [ ] `app/api/places/route.ts`
- [ ] Commit `phase 3: places and distance`

### Phase 4: Scoring engine
- [ ] `lib/time.ts`: IST hour, night window crossing midnight + tests
- [ ] `lib/scoring.ts`: `scoreFare(input): FareVerdict` implementing steps 1 to 7 of docs/SPEC.md
- [ ] `lib/validation.ts`: zod schemas for inputs and FareVerdict
- [ ] Tests: per_km, min_fare floor, night multiplier, per_session, regional fallback, 4 vs 5 community samples, `w` cap at 0.5, distance scaling, thresholds at 1.20 and 1.60 exactly, escalation (3 reports but 2 devices = no escalation, cap at HIGH_RISK), fair-range rounding, confidence levels, reason text
- [ ] Commit `phase 4: scoring engine`

### Phase 5: Fare check API and UI
- [ ] `lib/rate-limit.ts` (30 checks/hour/device) + tests
- [ ] `lib/server/device.ts` (read and validate `x-device-id`). The client side (`lib/client/device-id.ts`, `lib/client/api.ts`) was done in phase 1.
- [ ] `app/api/fare-check/route.ts`: validate, find area, distance, load benchmark, community and nearby scams, score, insert fare_check, return verdict + checkId
- [ ] `components/fare-check/*`: service picker, place picker (presets, search, map), time (default now), session type for guides, quoted price
- [ ] `components/map/LazyMap.tsx` + `MapPicker.tsx` (`ssr:false`, loaded only on "Pick on map", CircleMarker/divIcon only)
- [ ] `components/verdict/*`: colour + icon + text label, fair range in large type, reasons, confidence and source badges ("Demo estimate"), distance method, "Show the driver" and "Report what I paid" buttons
- [ ] `app/page.tsx`, checked at 375 px
- [ ] Commit `phase 5: fare check api and ui`

### Phase 6: AI explanation
- [ ] `lib/explain-template.ts`: deterministic 2 to 3 sentences + negotiation tip + tests
- [ ] `lib/number-guard.ts`: extract numbers (handles commas, the rupee sign, x, decimals), allow rounding, reject unknown numbers + tests
- [ ] `lib/explain.ts`: OpenAI-compatible fetch (D1), 6 s timeout, tone rules (no blame, no legal claims, "may be overpriced"), guard, fallback + tests with a mocked fetch
- [ ] `app/api/explain/route.ts` (by `checkId`, caches the result in `fare_checks.explanation`)
- [ ] `components/verdict/Explanation.tsx`: loads after the card renders
- [ ] Works with no key (template only)
- [ ] Commit `phase 6: ai explanation`

### Phase 7: Reports
- [ ] `app/api/reports/route.ts`: POST multipart, zod, 5 reports/hour/device, photo is jpeg/png/webp up to 2 MB, saved to the private `evidence` bucket; GET recent (no photo URLs)
- [ ] `app/api/reports/[id]/vote/route.ts` (one vote per device)
- [ ] `components/report/*`: fare vs scam modes, scam tag picker, photo input with client-side compression to about 1 MB
- [ ] `app/report/page.tsx`, prefilled from the verdict card
- [ ] UI shows only "Evidence attached". No driver names, phone numbers or registration numbers anywhere.
- [ ] Commit `phase 7: reports`

### Phase 8: Hotspot map
- [ ] `lib/hotspots.ts`: grid clustering of `is_scam` reports (last 90 days), counts, distinct devices, top tags + tests
- [ ] `app/api/hotspots/route.ts`
- [ ] `components/map/HotspotMap.tsx` (lazy, circles sized by count)
- [ ] `app/map/page.tsx`: map + recent reports list + "This happened to me too"
- [ ] Commit `phase 8: hotspot map`

### Phase 9: Show-the-driver card
- [ ] `lib/driver-lines.ts`: polite lines in EN / AS / BN / HI
- [ ] `components/driver/ShowDriverCard.tsx`: full screen, high contrast, fair range, language switcher, Noto Sans Bengali / Devanagari loaded only here
- [ ] Native-speaker check of translations (D7)
- [ ] Commit `phase 9: show the driver card`

### Phase 10: Offline / PWA
- [ ] `app/manifest.ts`, icons
- [ ] `public/sw.js`: precache shell, stale-while-revalidate for `/api/offline-pack`, network-only for other API calls
- [ ] `app/api/offline-pack/route.ts`, `lib/client/offline-store.ts`
- [ ] Offline fare check: browser runs `scoreFare` with benchmark + haversine x 1.3, labelled "Offline estimate"
- [ ] Commit `phase 10: offline pwa`

### Phase 11: Polish and demo mode
- [ ] `app/about/page.tsx`: algorithm, thresholds rendered from `lib/config.ts`, data sources, limitations (device-ID spoofing, demo estimates, Nominatim limits)
- [ ] Demo mode (D4)
- [ ] Loading, empty and error states. Accessibility pass (44 px targets, contrast, labels, never colour alone)
- [ ] `docs/DEMO.md` (judge walkthrough script)
- [ ] Commit `phase 11: polish and demo mode`

### Phase 12: Deploy
- [ ] Vercel project, env vars set (server-only)
- [ ] Hosted Supabase migrated + seeded
- [ ] Smoke test on a real phone, including on a slow connection
- [ ] Final README: setup, architecture, honesty and privacy rules, known limitations
- [ ] Commit `phase 12: deploy`

---

## Draft schema (`supabase/migrations/0001_init.sql`)

```sql
create table areas (
  id          text primary key,
  name        text not null,
  state       text not null,
  center_lat  double precision not null,
  center_lng  double precision not null,
  radius_km   numeric(6,2) not null check (radius_km > 0)
);

create table places (
  id       uuid primary key default gen_random_uuid(),
  area_id  text not null references areas(id) on delete cascade,
  name     text not null,
  kind     text not null check (kind in ('railway','airport','bus_stand','temple','market','park','other')),
  lat      double precision not null,
  lng      double precision not null,
  unique (area_id, name)
);
create index places_name_idx on places using gin (to_tsvector('simple', name));

create table fare_benchmarks (
  id               uuid primary key default gen_random_uuid(),
  area_id          text references areas(id) on delete cascade,   -- null = regional default
  service_type     text not null check (service_type in ('auto','taxi','bike_taxi','shared_sumo','guide')),
  pricing_unit     text not null check (pricing_unit in ('per_km','per_session')),
  base_fare        numeric(10,2),
  per_km_rate      numeric(10,2),
  min_fare         numeric(10,2),
  night_multiplier numeric(4,2) not null default 1.0 check (night_multiplier >= 1),
  night_start      smallint not null default 22 check (night_start between 0 and 23),
  night_end        smallint not null default 5  check (night_end between 0 and 23),
  session_rates    jsonb,
  source           text not null check (source in ('official','app_comparison','demo_estimate')),
  source_note      text,
  updated_at       timestamptz not null default now(),
  unique nulls not distinct (area_id, service_type),
  check (
    (pricing_unit = 'per_km' and base_fare is not null and per_km_rate is not null and min_fare is not null)
    or (pricing_unit = 'per_session' and session_rates ? 'half_day' and session_rates ? 'full_day')
  )
);

create table reports (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null,
  area_id       text references areas(id),
  service_type  text not null check (service_type in ('auto','taxi','bike_taxi','shared_sumo','guide')),
  pickup_lat    double precision not null,
  pickup_lng    double precision not null,
  drop_lat      double precision,
  drop_lng      double precision,
  distance_km   numeric(7,2) check (distance_km > 0),
  session_type  text check (session_type in ('half_day','full_day')),
  quoted_price  numeric(10,2) check (quoted_price > 0),
  paid_price    numeric(10,2) check (paid_price > 0),
  felt_fair     boolean,
  is_scam       boolean not null default false,
  scam_tags     text[] not null default '{}' check (scam_tags <@ array[
                  'hidden_charges','meter_refusal','fake_closure_detour','inflated_tourist_price',
                  'luggage_surcharge','wrong_change','other']::text[]),
  description   text check (char_length(description) <= 500),
  photo_path    text,
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now(),
  check (paid_price is not null or is_scam),
  check ((service_type = 'guide') = (session_type is not null)),
  check (service_type = 'guide' or (drop_lat is not null and drop_lng is not null and distance_km is not null))
);
create index reports_blend_idx  on reports (area_id, service_type, created_at desc) where not is_scam;
create index reports_scam_idx   on reports (created_at desc, pickup_lat, pickup_lng) where is_scam;
create index reports_device_idx on reports (device_id, created_at desc);

create table report_votes (
  report_id  uuid not null references reports(id) on delete cascade,
  device_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_id)
);

create table fare_checks (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null,
  area_id       text references areas(id),
  service_type  text not null,
  distance_km   numeric(7,2),
  quoted_price  numeric(10,2) not null,
  verdict       text not null check (verdict in ('FAIR','SUSPICIOUS','HIGH_RISK')),
  ratio         numeric(6,3) not null,
  result        jsonb,   -- D2
  explanation   text,    -- D2
  created_at    timestamptz not null default now()
);
create index fare_checks_device_idx on fare_checks (device_id, created_at desc);

alter table areas           enable row level security;
alter table places          enable row level security;
alter table fare_benchmarks enable row level security;
alter table reports         enable row level security;
alter table report_votes    enable row level security;
alter table fare_checks     enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
```

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Night window computed in UTC on Vercel | Compute the hour in `Asia/Kolkata`, with tests |
| Vercel 4.5 MB request body limit for photo uploads | Compress on the client to about 1 MB, server cap 2 MB |
| Nominatim 1 req/s can't be enforced globally on serverless | Seeded places first, 500 ms debounce, min 3 chars, per-instance throttle and cache, NE viewbox |
| ORS quota (about 2,000/day, 40/min) and latency | 3 s timeout, haversine fallback, coordinate cache |
| Seed reports fall out of the 90/180-day windows | Seed dates relative to `now()` |
| Number guard rejects valid LLM text | Prompt forbids new numbers; guard normalises formatting; template fallback is acceptable |
| Free LLM tiers change limits or terms, or are slow | Provider-agnostic env config, 6 s timeout, template fallback; only verdict numbers are sent (no personal data) |
| Leaflet marker images break under bundlers; SSR crash | CircleMarker/divIcon only, `dynamic(..., { ssr:false })` |
| Heavy Indic fonts on slow connections | Load only in the Show-the-driver card |
| `create-next-app` refuses a non-empty dir | Scaffold in a temp dir and move the files in |
| Supabase Free pauses a project after about 7 days without activity | Open the app or run a query in the days before the demo; unpausing is free |
| Free quotas run out during the demo (ORS, Groq, Nominatim) | Every one has a free fallback; demo mode forces the fallbacks |
| Device ID spoofing; count-then-insert rate-limit race | Documented as known MVP limitations |

---

## Next up
Phase 2: Database and seed. Needs a free Supabase project, with the URL and secret key in `.env.local`. Decisions D2 to D8 are treated as accepted unless changed.
