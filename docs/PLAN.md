# Travel Trap Detector: Implementation Plan

Source of truth for the product spec is `docs/SPEC.md`. This file tracks how we build it and what is done.

Status legend: `[x]` done, `[ ]` to do. Each phase ends with: lint, typecheck, tests, update this file, commit `phase N: <summary>`.

---

## Decisions log

| # | Decision | Status |
|---|---|---|
| D1 | **LLM uses a free provider, not Anthropic.** `lib/explain.ts` calls any OpenAI-compatible chat-completions endpoint with plain `fetch` (no SDK). Env: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Provider: **Groq free tier** (`https://api.groq.com/openai/v1`, default model `llama-3.3-70b-versatile`, check against Groq's current list). Gemini or OpenRouter work with an env change only. Template fallback when no key, on timeout, or when the number guard fails. | **Agreed**, docs/SPEC.md updated |
| D2 | `fare_checks` gets `result jsonb` and `explanation text`. `/api/explain` takes a `checkId`, never client-supplied verdict JSON, so the client can't inject prompts or run up cost. | Proposed |
| D3 | Seed areas: Guwahati, Shillong, Kaziranga (Kohora), Gangtok, Tawang, plus regional defaults. All values are `demo_estimate` unless an official chart is supplied. | **Agreed** (phase 2 spec) |
| D4 | Demo mode: `?demo=1` shows 3 scenario chips (FAIR, SUSPICIOUS, HIGH_RISK with community escalation at Guwahati Railway Station), a fixed trip time, and the ORS fallback forced. | Proposed |
| D5 | `report_votes` powers a "This happened to me too" button on map reports. The count is display-only and does not affect escalation. | Proposed |
| D6 | Offline: cached app shell plus a benchmark-only "Offline estimate" scored in the browser. No queue for offline reports unless requested. | Proposed |
| D7 | The driver-card lines in Assamese, Bengali and Hindi are first drafts and must be checked by a native speaker before the demo. | Open |
| D8 | Accounts needed: hosted Supabase project, ORS key, Vercel account, free LLM key. Migrations are run in the Supabase SQL editor (no Docker needed). | Open |
| D0 | **Zero spending.** Only free, no-card services: Supabase Free, Vercel Hobby, ORS free key, Groq free, Nominatim, OSM tiles. Every external dependency has a free fallback. | **Agreed**, in docs/SPEC.md |
| D9 | Area IDs are text slugs (`'guwahati'`), other IDs are UUIDs. Geo queries use a bounding box plus haversine in code, so no PostGIS. | Agreed |
| D10 | The night window is computed in `Asia/Kolkata`, because the server runs in UTC. | Agreed |
| D11 | Service worker via Serwist 9.5 with its Turbopack integration (chosen in phase 10 after a compatibility check). Lint runs `eslint .` because `next lint` was removed in Next 16. | Agreed |

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
supabase/migrations/001_init.sql
supabase/seed.sql               idempotent; benchmark table in the header
scripts/check-db.ts             row counts + seed sanity (npm run db:check)
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
Changed from the original plan at the user's request: the seed is plain SQL (`supabase/seed.sql`) rather than a TS script, there are 5 areas (Sohra dropped), and there's a `check-db` script. `lib/server/repo.ts` moves to phase 3, where the first queries are needed.

- [x] `supabase/migrations/001_init.sql`: 6 tables, check constraints, indexes (area+service+created_at, created_at, pickup lat/lng, device+created_at), RLS on with no policies, grants revoked from anon/authenticated, private `evidence` bucket (2 MB, images only). Idempotent.
- [x] `supabase/seed.sql`: 5 areas, 28 places (OSM coordinates, element IDs in comments), 30 benchmarks (25 area rows + 5 regional defaults, all `demo_estimate`, number table at the top), 100 seed reports (70 normal, 30 scams, 2 to 119 days old). Report prices are computed from the benchmark rows, so they follow edits. Idempotent, with a sanity check that rolls back on a bad place name.
- [x] Seed hotspots: Guwahati Railway Station (11 scams from 5 devices; 9 from 4 within 90 days) and Guwahati airport (9 from 5; 8 from 4 within 90 days). Every other place stays below the escalation threshold. Seven places have no reports.
- [x] Verified locally in PGlite (Postgres in WASM): both files run twice, counts match, escalation and blend samples as designed, constraints reject bad rows
- [x] `scripts/check-db.ts` (`npx tsx scripts/check-db.ts` or `npm run db:check`): row counts, seed split, bucket privacy, hotspot escalation check
- [x] User ran migration + seed in the Supabase SQL Editor; `check-db` prints "All checks passed" (2026-10-10, project in Mumbai region, "auto-expose new tables" off)
- [x] Commit `phase 2: database and seed`

Not fully verified (also listed in the seed.sql header): which Guwahati airport terminal handles arrivals (T1 used, T2 also mapped); Pakyong terminal isn't mapped, so the airfield centre is used; Police Bazar is the centre of the street.

### Phase 3: Places, area detection and distance
Built to the user's phase 3 spec. Differences from the first plan: separate `/api/geocode` and `/api/distance` routes; no `lib/places.ts` (PlacePicker merges seeded matches with OSM results on the client); timeout 4 s; × 1.3 everywhere (per-area road factor declined for now, see risks).

- [x] `lib/geo.ts`: `haversineKm`, `withinRadiusKm`, `nearestArea` (null = regional default), `roundTo` + tests
- [x] `lib/lru-cache.ts`: in-memory LRU with TTL + tests
- [x] `lib/distance.ts`: ORS driving-car at `api.heigit.org/openrouteservice` (2,000/day; the old host allows only about 200), 4 s timeout, Haversine × 1.3 fallback on any error, returns `method`, caches road results by coordinates rounded to 4 decimals (estimates are never cached) + tests
- [x] `lib/nominatim.ts`: custom User-Agent, NE India bounding box (`bounded=1`, `countrycodes=in`), serialised 1 req/s throttle, 24 h cache + tests with a fake clock
- [x] `lib/server/repo.ts`: `listAreas`, `listPlaces`; `lib/validation.ts`: zod schemas
- [x] `GET /api/places`: presets grouped by area, `"use cache"` + `cacheLife("hours")` and `Cache-Control: max-age=3600`; runs at request time, so builds don't need the DB
- [x] `GET /api/geocode?q=`: Nominatim proxy, 400 below 3 characters
- [x] `POST /api/distance`: `{ distanceKm, durationMin?, method }`
- [x] `components/PlacePicker.tsx`: Popular (native select grouped by area), Search (seeded matches first, then OSM, deduped within 100 m), Map (tap to pick). `components/map/MapPointPicker.tsx` loads client-only via `next/dynamic` with `ssr: false`. Default marker fixed by pointing `L.Icon.Default` at `/public/leaflet/*.png`.
- [x] Temporary `components/fare-check/RoutePreview.tsx` on `/` (phase 5 folds it into the form)
- [x] Verified in the browser at 375 px: Railway Station → Kamakhya = 6.8 km, `method: road`. With a disabled key (`dev-no-ors` launch config): ≈ 6.3 km, `method: estimate`. Map tap, search and marker icon all work. 56 tests pass; lint, typecheck and build are clean.
- [x] Commit `phase 3: places, area detection and distance`

Notes: Next 16 allows only one `next dev` per project folder, so stop `dev` before starting `dev-no-ors`. `/api/distance` and `/api/geocode` have no rate limit yet; the ORS quota could be drained by abuse (see risks).

### Phase 4: Scoring engine
- [x] `lib/time.ts`: India-time hour via `Intl` (server zone doesn't matter), night window `[start, end)` that can cross midnight + tests
- [x] `lib/labels.ts`: service, session and scam-tag labels; "a"/"an" before numbers
- [x] `lib/scoring.ts`: `scoreFare(input): FareVerdict`, pure, steps 1 to 7 of docs/SPEC.md; plus `selectBenchmark`, `communitySamples`, `nearbyScams`, `verdictForRatio`, `raiseOneLevel`, `median`
- [x] Tests (63 in `scoring.test.ts`, 6 in `time.test.ts`): verdicts, exact 1.20 / 1.60 boundaries (incl. float noise), min fare, night window edges incl. crossing midnight, blend ignored at 4 and weighted at 5 / 10 / 30, median not mean, distance scaling and the ±20% edge, escalation (3 devices yes, 1 device no, capped at HIGH_RISK, 500 m / 90 days), guide sessions, fair-range rounding, all 3 confidence levels, reason wording, benchmark selection, input validation
- [x] Five example verdicts run against the real seed data (in the phase 4 report)
- [x] Commit `phase 4: scoring engine`

Interpretations (docs/SPEC.md is silent on these):
- `scoreFare` gets candidate reports and applies every filter itself, so all the rules are tested in one place; the DB query only pre-filters roughly.
- No community blend for trips outside every area ("same area" is undefined there). Such trips are LOW confidence anyway.
- The ratio uses the expected fare rounded to whole rupees, so the numbers in the reasons agree with each other.
- The night multiplier applies to the benchmark part only; community medians are blended in as reported.
- `communitySampleSize` is the number of matching reports even when below 5 (the reasons say they weren't used).
- Zod schemas for the fare-check request move to phase 5, where the route needs them.

### Phase 5: Fare check API and UI
Built to the user's phase 5 spec (route is `/api/check`, card is `components/VerdictCard.tsx`).

- [x] `lib/device.ts` (shared ID format + header name), `lib/server/device.ts` (reads `x-device-id`)
- [x] `lib/rate-limit.ts`: 30 fare checks / 5 reports per device per hour + tests (counted from `fare_checks`)
- [x] `lib/geo.ts` `boundingBox` + tests; `lib/validation.ts` `checkRequestSchema` (guide needs session, others need drop, quote ₹1–₹1,00,000, trip time within 30 days)
- [x] `lib/explain.ts`: `templateExplanation` (2–3 sentences + one polite tip, only numbers from the verdict, no accusing words) + tests
- [x] `lib/server/repo.ts`: benchmarks, community candidates (area + service + 180 days), scam candidates (bounding box + 90 days), fare-check count and insert; `lib/server/reference-data.ts` caches areas and benchmarks for 1 h
- [x] `POST /api/check`: device ID → zod → rate limit → area → distance → benchmark → candidates → `scoreFare` → log to `fare_checks` (logging failure doesn't hide the verdict) → verdict + template explanation. 400 / 422 / 429 / 503 with plain messages.
- [x] Home form: large icon service buttons (radio group), PlacePicker pickup/drop, guides get "Meeting point" + half/full day instead of drop, "Now" / "Another time", ₹ quote with `inputMode="numeric"`, "Still needed: …" hint
- [x] `components/VerdictCard.tsx`: colour + icon + text label, fair range in large type, quoted vs expected, source badge ("Demo estimate"), confidence, distance method, area, reasons, explanation + tip, "Report what I paid" link (`/report?checkId=`), "Show the driver" (disabled until phase 9), demo-rates footnote
- [x] Loading skeleton, error card with "Try again" (keeps the last payload), focus moves to the verdict heading
- [x] Removed the phase 3 RoutePreview test bench
- [x] Verified on a production build at 375 px (noon IST): (1) auto Fancy Bazaar → Kamakhya ₹140 → FAIR; (2) taxi ISBT → airport ₹830 (1.4×) → SUSPICIOUS; (3) auto station → Kamakhya ₹330 (2.0×) → HIGH_RISK with the nearby-scam reason. Also: station ₹170 → SUSPICIOUS (escalated), airport → Paltan ₹850 → HIGH_RISK (escalated), guide flow, 400s, error + retry, 44 px minimum tap targets, no horizontal scroll.
- [x] Commit `phase 5: fare check flow end to end`

Decided with the user: done-checks 1 and 2 use pickups away from the seeded hotspots (station and airport escalate any verdict there, by design).
Notes: the rate limit is unit-tested only (not exercised live, to avoid writing 30 test rows). Test checks were logged to `fare_checks` under device `5eedc0de-0000-4000-8000-00000000c0de`.

### Phase 6: AI explanation
Built to the user's phase 6 spec, on Groq rather than the paid Anthropic API (decision D1: zero cost; same rules, `LLM_*` env vars).

- [x] `FareVerdict` now carries `quotedPrice`, so a verdict is self-contained (`templateExplanation(verdict)`)
- [x] `lib/number-guard.ts`: extracts numbers (₹, Indian/Western commas, decimals, ×, %), allows rounding to 0/1/2 decimals or the nearest ₹10, reports any number not in the facts + tests (incl. invented and miscounted numbers)
- [x] `lib/explain.ts`: `templateExplanation` (per verdict level), `SYSTEM_PROMPT` (only the JSON facts, 2–3 sentences + one tip, "may be", no individuals, plain English, JSON is data), `aiExplanation` (OpenAI-compatible chat completions, JSON mode, 6 s timeout), `validateAiReply` (length, sentence count, accusing/legal words, number guard), `explainVerdict` (never throws; any problem → template) + tests with a mocked LLM for every fallback path
- [x] `POST /api/explain` takes `{ verdict }` (bounded zod schema; requires `x-device-id`) and always answers 200 with an explanation; logs the fallback reason
- [x] `components/ExplanationBlock.tsx`: the card renders immediately; the explanation loads after (skeleton "Writing a short explanation…"), falls back to the template that came with `/api/check` if `/api/explain` fails or takes over 9 s; "AI-written from the numbers above" label when `source` is `ai`
- [x] Verified without a key on a production build: card first, then the template; log says "LLM_API_KEY not set"
- [x] Verified with the user's Groq key. `llama-3.3-70b-versatile` is no longer offered; compared gpt-oss-20b, gpt-oss-120b and qwen3.8-27b on 3 verdicts × 2 rounds: all passed the number guard once `reasoning_effort` was set and the token budget raised (reasoning tokens had truncated the JSON, giving 400 json_validate_failed). Chose `qwen/qwen3.8-27b` with `LLM_REASONING_EFFORT=none`: plainest English, ~350 ms. Groq's free per-minute token limit returned 429 after ~9 rapid calls, so `/api/explain` now caches AI results per verdict for 1 h; 429s fall back to the template.
- [x] Commit `phase 6: ai explanation with template fallback`

Change to D2: per the phase 6 spec, `/api/explain` takes the verdict from the browser instead of a `checkId`. Mitigations: bounded schema (≤ 12 reasons × 400 chars), the prompt treats the JSON as data, the reply must pass the number guard and the wording filter, and the text is shown only to the person who sent it. `fare_checks.explanation` is currently unused. No rate limit on `/api/explain`: abuse only uses up the free Groq quota, after which the template is served.

### Phase 7: Reports
Built to the user's phase 7 spec. Photo upload uses a server-issued signed upload URL (user's choice; documented exception in docs/SPEC.md).

- [x] `lib/redact.ts`: removes phone numbers (8+ digits with separators) and Indian plates (state-code series, BH series) from descriptions, without touching prices or distances + 18 tests
- [x] `lib/validation.ts` `reportRequestSchema` (paid price unless scam; ≥1 tag for scams, none otherwise; 280-char description; photo path must match the issued shape) + tests
- [x] `lib/rate-limit.ts` `MemoryRateLimiter` (upload URLs: 10/hour/device per instance) + tests
- [x] `lib/nearby.ts` `toNearbyReports` (exact 1 km radius, newest first, vote counts, `isMine` / `votedByMe`, never device IDs or photo paths) + tests
- [x] `POST /api/reports/upload-url`: path `<device>/<uuid>.jpg`, refused once the 5/hour report limit is hit
- [x] `POST /api/reports`: zod, 5/hour/device, photo must belong to the device and exist in storage, ORS distance, area, redaction, 201 `{ id, redacted }`
- [x] `GET /api/reports/nearby?lat=&lng=`: last 180 days within 1 km, max 20
- [x] `POST /api/reports/[id]/vote`: 201, 409 duplicate (report_votes primary key), 403 own report, 404 unknown
- [x] UI: `components/report/*` (form, tag chips, photo input compressing to < 300 KB and dropping EXIF, nearby list with "Me too", thank-you screen), `components/ui/PriceInput.tsx`, `YesNo.tsx`; form is client-only so it can read the draft from sessionStorage; "Report what I paid" hands over the trip without putting coordinates in the URL
- [x] Verified live on a production build: new report in nearby results; second vote 409; 6th report 429; signed upload 200; public photo URL 400; redaction; full UI flow at 375 px
- [x] Commit `phase 7: community reports`

Test reports and votes were deleted in phase 8; their photos may remain in the `evidence` bucket.

### Phase 8: Scam hotspot map
Built to the user's phase 8 spec, with two agreed changes: cells are circles centred on the densest reports (a fixed grid can split a tight cluster so it drops below 3 devices), and their radius is the warning rule's 500 m rather than ~250 m, so the map and the verdict card show the same counts.

- [x] `lib/scoring.ts` `benchmarkExpectedFare` (step 1 on its own, reused for overcharge)
- [x] `lib/hotspots.ts` `findHotspots`: last 90 days, optional service filter, ≥3 distinct devices, count, distinct travellers, top 3 tags, typical overcharge (median quoted ÷ rate card, night rate by report time), last report, nearest preset place and area; `hotspotLevel` bands + 12 tests (incl. 1–2 device cells excluded, one device ×3 excluded, cluster across a grid line not split, no device IDs)
- [x] `GET /api/hotspots?service_type=`: zod-validated filter, `"use cache"` + `cacheLife("minutes")`
- [x] `/map`: service filter, Leaflet map (client-only) with circles sized and coloured by count plus a text legend, popup per hotspot, accessible list sorted by count with "Show on map", centres on the user's location if allowed (never sent to the server), otherwise Guwahati
- [x] Verified on a production build at 375 px: station 9 reports / 4 travellers and airport 8 / 4 appear; Kamakhya, Police Bazar, MG Marg and Kohora (2 devices each) don't; filters, popup, "Show on map", empty state, no horizontal scroll
- [x] Deleted the phase 7 test reports and vote (with the user's OK); `db:check` passes with the 100 seed reports
- [x] Commit `phase 8: scam hotspot map`

### Phase 9: Show-the-driver card
Built to the user's phase 9 spec.

- [x] `lib/i18n/driver-card.json`: English, Assamese, Bengali, Hindi; 8 strings each; every non-English string marked "needs native speaker review" (change to "reviewed by <name>, <date>" once checked)
- [x] `lib/i18n/driver-card.ts`: typed access, `driverLine` fills the fair range (word joiners keep "₹150–₹190" on one line) + tests (all keys present, review flags, placeholders, correct script, Assamese ৰ/ৱ)
- [x] `components/driver/ShowDriverCard.tsx`: native `<dialog>` (focus trap, Esc), full screen, black on white, from → to or guide session, fair range in very large type, polite line, thank you, honest footer ("demo estimate"); language switcher with native names, remembered in localStorage; `lang` attributes; Noto Sans Bengali / Devanagari via next/font (script subsets, no preload) inside a chunk loaded only when the card opens; Wake Lock taken on open, re-taken when the tab returns, released on close
- [x] Verified on a production build at 375 px in all four languages: fonts loaded, no overflow, range on one line; Esc and × close it; language remembered. The in-app test browser denies Wake Lock (NotAllowedError) and the card continues normally; untested on a real phone.
- [ ] Native speakers check the Assamese, Bengali and Hindi strings (D7)
- [x] Commit `phase 9: show the driver card`

Note: place names stay in English (they come from OSM / the seed list).

### Phase 10: PWA and offline fallback
Built to the user's phase 10 spec.

Library choice: **Serwist 9.5 (`@serwist/turbopack` + `serwist`)**. It is actively maintained (released 2026-10-04), supports Next ≥ 14, and has a Turbopack integration, which matters because Next 16 builds with Turbopack. Rejected: `next-pwa` (unmaintained since 2022), `@ducanh2912/next-pwa` (deprecated in favour of Serwist, webpack-only), hand-rolled Workbox (more code to own). Compatibility issue found and fixed: Serwist's route exports `dynamic`, `dynamicParams` and `revalidate`, which Next 16 removes under Cache Components, so `app/serwist/[path]/route.ts` re-exports only `GET` and `generateStaticParams`. `reloadOnOnline` is turned off so coming back online doesn't wipe the screen or race the report queue.

- [x] `app/manifest.ts` (name, short name, standalone, portrait, theme #0f766e), original icons from `public/icons/icon.svg` via `npm run icons` (192, 512, maskable 512 with safe zone, apple-touch 180), metadata (apple web app, icons)
- [x] `app/sw.ts` + `app/serwist/[path]/route.ts`: precache the app shell (all static pages + `/~offline` fallback, versioned by git commit), Serwist default runtime caching (static assets, same-origin GET /api network-first, map tiles); `app/~offline/page.tsx`
- [x] `GET /api/offline-pack` (areas, places, benchmarks) saved to localStorage (`lib/client/offline-store.ts`, refreshed every 6 h while online); place picker falls back to it
- [x] `lib/offline-check.ts`: `scoreFare` in the browser with Haversine × 1.3, the saved benchmark, no community data, template explanation, an extra reason, `offline: true` + 6 tests; used when `navigator.onLine` is false or the request fails with a network error; the verdict card shows "Offline estimate, community data not included" and skips /api/explain
- [x] `lib/client/report-queue.ts`: offline reports (photo kept as a data URL, max 5) saved and sent oldest-first when back online, on app start, on return to the foreground and every 30 s; invalid ones dropped, others retried + 6 tests; "Report saved on your phone" screen
- [x] `components/ConnectivityManager.tsx`: offline banner (also when the server is unreachable), queued count, "sent" notice
- [x] Verified on a production build: installable (manifest, icons, SW active and controlling, 40 precache entries, pack saved). With the server stopped: pages load from cache, a fare check returns the labelled offline estimate, a report is queued; after restarting, the queued report was sent and appears on the server. With `navigator.onLine` false (the DevTools Offline case) the estimate is instant (26 ms) and the banner shows.
- [x] Commit `phase 10: pwa and offline fallback`

Notes: a refused connection takes ~2 s to fail on Windows, so the server-down fallback isn't instant; DevTools Offline is. Service worker is disabled in `npm run dev`; test offline with `npm run build && npm start`.

### Phase 11: Polish and demo mode
Built to the user's phase 11 spec.

- [x] `/about`: plain-language steps, formulas and thresholds rendered from `lib/config.ts` (a test renders the page and checks the config values appear), data sources with honesty labels, privacy, known limitations
- [x] Demo mode: "Try a demo" on the home page fills the form (service, places, 12:00 India time via `noonInIndiaToday`, quote). Four scenarios in `lib/demo-scenarios.ts`: fair auto (Fancy Bazaar → Kamakhya ₹130), suspicious airport taxi (ISBT → airport ₹750; the pickup avoids the airport hotspot, which would escalate), high-risk station ride (₹400), Kaziranga full-day guide (₹2,400 → Suspicious). Quotes chosen to hold with road or estimated distance; unit-tested both ways and verified live.
- [x] Accessibility: global `:focus-visible` ring, reduced-motion support, fair/suspicious colours darkened for margin (6.5:1 and 6.4:1 on their tints; every colour pair ≥ 4.5:1), DOM audit of the verdict card, report form (scam mode) and map popup: no unnamed controls
- [x] Performance: `experimental.inlineCss` (no render-blocking CSS; pages 10–25 KB gzipped), offline pack fetched when idle, map no longer asks for location on load ("Use my location" button; auto-centres only if already granted), preconnect to the OSM tile server
- [x] Lighthouse mobile (production build): home 92 / 100 / 100 / 100, about 98 / 100 / 100 / 100, report 99 / 100 / 100 / 100, map 88 / 100 / 96 / 100 (perf / a11y / best practices / SEO). Map LCP is a third-party OSM tile, and its remaining best-practice item is OSM's low-resolution tiles.
- [x] README: what it is, setup, env vars, scripts, Mermaid architecture diagram (checked with Mermaid 11), scoring, data honesty, privacy, limitations, quality, a 2-minute demo script
- [x] 255 tests pass
- [x] Commit `phase 11: polish and demo mode`

Not fixed (by design or third party): API JSON isn't gzipped by `next start` locally (Vercel compresses responses); 13 KiB of legacy polyfills in a framework chunk.

### Phase 12: Deploy and final check
- [x] Vercel fix: the service worker is now built **at build time** (`● /serwist/sw.js`, prerendered through a `"use cache"` helper). Before, the route was dynamic and would have run esbuild inside a Vercel function, where it and the source files aren't available. The revision uses `VERCEL_GIT_COMMIT_SHA` on Vercel.
- [x] `vercel.json`: function region `bom1` (Mumbai), next to the Supabase project
- [x] Secret scan of everything a browser can download (105 files: client JS/CSS, prerendered HTML/RSC, route bodies, service worker, `public/`): no key names, no key values, no `sb_secret_` / `gsk_`, no server-only Supabase code. Positive control confirmed the scan reads the client bundle. Git history (17 commits): no secret values; only `.env.example` is tracked.
- [x] RLS tooling: `supabase/checks/verify-security.sql` (RLS flag, policy count and anon/authenticated grants per table, bucket privacy) and `npm run rls:check` (public-key read/write/storage attempts must all fail). Earlier evidence: the migration was verified in PGlite (RLS on all 6 tables; anon denied; service_role allowed).
- [ ] User runs `verify-security.sql` in Supabase (and optionally `npm run rls:check`) and confirms the result
- [x] `docs/DEPLOY.md`: GitHub → Vercel Hobby walkthrough, environment variables with which are secret (never `NEXT_PUBLIC_`), post-deploy checks, real-phone checklist (mobile data, Slow 4G, offline)
- [ ] User deploys to Vercel; live URL added to README and here
- [ ] Phone checklist run on the live URL
- [x] Commit `phase 12: deploy readiness and security checks`

Live URL: _pending first deploy_

---

## Draft schema (superseded: the live version is `supabase/migrations/001_init.sql`)

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
| Haversine × 1.3 fallback underestimates hill roads about 2× (Pakyong → Gangtok: 14 km vs 26.5 km by road), so a fair hill fare could show HIGH_RISK when ORS is unavailable | ORS is the main path; estimates are labelled. Option kept open: per-area `road_factor` column |
| `/api/distance` has no rate limit, so abuse could use up the ORS daily quota | Estimate fallback keeps the app working; add a per-device limit in phase 5 if needed |
| Free quotas run out during the demo (ORS, Groq, Nominatim) | Every one has a free fallback; demo mode forces the fallbacks |
| Device ID spoofing; count-then-insert rate-limit race | Documented as known MVP limitations |

---

## Next up
Deploy to Vercel (docs/DEPLOY.md), then add the live URL. Decisions D2 to D8 are treated as accepted unless changed.
