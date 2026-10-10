# Travel Trap Detector

Hackathon prototype for CodeWar 8.0, Problem 5 (PS_OPPORTUNITIES). This file is the source of truth. Read it before every phase. If a request conflicts with this file, ask before deviating.

## Product in one paragraph

A mobile-first web app for travellers in North East India. The user picks a service (auto, taxi, bike taxi, shared Sumo seat, or local guide), sets pickup and drop points, and enters the price they were quoted. The app returns a verdict (FAIR, SUSPICIOUS or HIGH_RISK), a fair price range, and a plain-language explanation. Travellers can report what they paid and flag scams. Those reports improve the benchmarks and feed a scam hotspot map.

Two requirements from the problem statement must be obvious in the demo:
1. Risk is based on pricing data plus community intelligence.
2. Every verdict explains its reasoning. Never show a bare score.

## Stack

- Next.js (App Router, TypeScript strict, current stable) with Tailwind CSS, set up by create-next-app. No `src/` directory.
- Supabase Postgres + Storage. The browser never talks to Supabase directly: all reads and writes go through route handlers in `app/api/` using the server-side secret (service role) key. RLS is enabled on every table with no public policies.
  - One exception (agreed in phase 7): evidence photos are uploaded by the browser to a server-issued signed upload URL for a single object path in the private `evidence` bucket. The browser can never read, list or overwrite files there.
- Leaflet + react-leaflet + OpenStreetMap tiles. Leaflet uses `window`, so map components must be client-only (`dynamic(..., { ssr: false })`).
- Road distance: OpenRouteService directions API (driving-car), called from the server. Fallback: Haversine distance × 1.3. Always return which method was used.
- Place search: a seeded list of popular NER places first, Nominatim search second (server-side, custom User-Agent, debounced, max 1 request per second).
- LLM: free provider (Groq by default) through any OpenAI-compatible chat-completions endpoint, called with plain `fetch` from the server only. No vendor SDK. Configure with `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` and optional `LLM_REASONING_EFFORT`; switching provider is an env change only. The app must work fully with no API key by falling back to a template explanation.
- Validation: zod. Tests: Vitest. Deploy: Vercel.

## Environment variables

Real values go in `.env.local` (gitignored). Commit only `.env.example`.

```
SUPABASE_URL=
SUPABASE_SECRET_KEY=          # service role / secret key, server only
ORS_API_KEY=                  # openrouteservice.org, server only
LLM_BASE_URL=https://api.groq.com/openai/v1   # any OpenAI-compatible endpoint
LLM_API_KEY=                  # optional; free key from console.groq.com
LLM_MODEL=qwen/qwen3.8-27b                    # check Groq's current model list
LLM_REASONING_EFFORT=none                     # optional: "none" for Qwen 3, "low" for gpt-oss
```

## Data model

```
areas            id, name, state, center_lat, center_lng, radius_km
places           id, area_id, name, kind (railway|airport|bus_stand|temple|market|park|other), lat, lng
fare_benchmarks  id, area_id (null = regional default), service_type, pricing_unit (per_km|per_session),
                 base_fare, per_km_rate, min_fare, night_multiplier, night_start (default 22), night_end (default 5),
                 session_rates jsonb  -- {"half_day": n, "full_day": n} for guides
                 source (official|app_comparison|demo_estimate), source_note, updated_at
reports          id, device_id, area_id, service_type, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km,
                 session_type, quoted_price, paid_price, felt_fair bool, is_scam bool, scam_tags text[],
                 description, photo_path, is_seed bool, created_at
report_votes     report_id, device_id, created_at   -- primary key (report_id, device_id)
fare_checks      id, device_id, area_id, service_type, distance_km, quoted_price, verdict, ratio, created_at
```

- `service_type`: auto | taxi | bike_taxi | shared_sumo | guide. Guides use per_session pricing (half_day or full_day) and have no drop point.
- `scam_tags`: hidden_charges | meter_refusal | fake_closure_detour | inflated_tourist_price | luggage_surcharge | wrong_change | other
- `device_id`: random UUID stored in localStorage and sent as the `x-device-id` header. Known limitation: it can be spoofed. Acceptable for the MVP; mention it in the README.

## Scoring algorithm

Implemented in `lib/scoring.ts` as a pure function with full unit tests. All thresholds live in `lib/config.ts`.

1. **Expected fare.**
   - per_km: `max(min_fare, base_fare + per_km_rate × distance_km)`, multiplied by `night_multiplier` when the trip time falls in the night window (the window can cross midnight).
   - per_session: `session_rates[session_type]`.
   - Use the area's benchmark. If the area has none, or the point is outside every area, use the regional default (area_id null).
2. **Community blend.** Take reports with the same area and service type, distance within ±20% (or the same session type for guides), from the last 180 days, where `is_scam = false`. Scale each paid price to the current trip: `paid_price × (distance_km / report.distance_km)`. If there are at least 5 samples: `expected = (1 − w) × benchmark_expected + w × median(scaled)`, where `w = min(0.5, n / 20)`. Below 5 samples, ignore the community data.
3. **Ratio** = quoted_price ÷ expected. ratio ≤ 1.20 → FAIR. ratio ≤ 1.60 → SUSPICIOUS. ratio > 1.60 → HIGH_RISK.
4. **Community escalation.** If there are at least 3 `is_scam` reports within 500 m of the pickup in the last 90 days, from at least 3 distinct device_ids, raise the verdict one level (FAIR → SUSPICIOUS, SUSPICIOUS → HIGH_RISK, never beyond HIGH_RISK) and add a reason saying why.
5. **Fair range** = [expected × 0.90, expected × 1.15], each rounded to the nearest ₹10.
6. **Confidence.** HIGH = area-specific benchmark and at least 5 community samples. MEDIUM = area-specific benchmark only. LOW = regional default. (Data source is shown separately as a badge.)
7. **Output** (`FareVerdict` type): verdict, ratio, expectedFare, fairRange, distanceKm, distanceMethod, benchmarkSource, communitySampleSize, nearbyScam { count, distinctDevices, topTags }, confidence, reasons: string[].
   `reasons` are short factual sentences built in code, for example: "Quoted ₹600 is 2.1× the expected ₹285 for a 6.2 km auto ride."

## AI explanation rules (`lib/explain.ts`)

- Input: the FareVerdict JSON. Output: 2–3 short, friendly sentences plus one polite negotiation tip.
- The LLM may only restate facts from the input. After every response, extract all numbers from it. If any number is not in the input (allowing for rounding), discard the response and use the template.
- Never blame or name individuals. No legal claims. Say "may be overpriced", not "this is a scam".
- 6-second timeout, then fall back to the template. The verdict card renders immediately; the explanation loads afterwards.

## Screens

- `/` **Fare Check**: service type, pickup and drop (preset list, search, or tap on map), time (default now), session type for guides, quoted price → verdict card.
- **Verdict card**: colour + icon + text label (never colour alone), fair range in large type, reasons, AI explanation, confidence and source badges, distance method, and buttons "Show the driver" and "Report what I paid".
- `/report`: report a fare or a scam, with an optional photo.
- `/map`: scam hotspots and recent reports.
- `/about`: how scoring works, thresholds, data sources and limitations. Judges will read this.
- **Show the driver**: full-screen, high-contrast card with the fair range and one polite line in English, Assamese, Bengali or Hindi.

## Design

- Mobile-first: design at 375 px wide first. Tap targets at least 44 px.
- Must work on slow connections: no heavy images, lazy-load the map.
- Fonts via next/font. Noto Sans Bengali covers Assamese and Bengali script; Noto Sans Devanagari covers Hindi.
- Format rupees with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- Verdict colours: green, amber, red, each always paired with an icon and a text label.

## Privacy and honesty rules

- Never collect or display driver names, phone numbers or vehicle registration numbers. Flag patterns and places, never individuals.
- Evidence photos go to a private Storage bucket. The UI shows only "evidence attached", never the photo itself.
- Seed benchmark values are placeholders: `source = 'demo_estimate'`, `source_note = 'Replace with official fare chart'`. The UI must show a "Demo estimate" badge for them. Never label invented numbers as official.
- Seed reports have `is_seed = true`.
- Rate limits: max 5 reports and max 30 fare checks per device per hour.

## Zero cost

The prototype must cost nothing. Use only free tiers that need no credit card: Supabase Free, Vercel Hobby, OpenRouteService free key, Groq free tier, Nominatim, OSM tiles. No paid APIs, add-ons or plan upgrades. When a quota runs out, the app must degrade gracefully (ORS → Haversine, LLM → template, Nominatim → seeded places) instead of needing payment.

## Working conventions

- Business logic lives in `lib/` as pure, tested functions. Route handlers stay thin.
- Before coding each phase, show a short plan and wait for approval. After coding, run lint, typecheck and tests, and report the results.
- Commit at the end of each phase with the message `phase N: <summary>`.
- Keep `docs/PLAN.md` updated with what is done and what is next.
- Do not add features outside this spec without asking.

## Out of scope for the MVP

User accounts, payments, native apps, admin dashboards, and naming drivers or businesses.
