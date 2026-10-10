# Travel Trap Detector

A mobile-first web app that tells travellers in North East India whether a quoted price for an **auto, taxi, bike taxi, shared Sumo seat or local guide** looks fair, and **explains why**.

**Live demo:** _URL added after the first Vercel deploy_ · Deploy guide and phone test checklist: [docs/DEPLOY.md](docs/DEPLOY.md)

Built for CodeWar 8.0, Problem 5 (PS_OPPORTUNITIES). The two requirements from the problem statement:

1. **Risk comes from pricing data plus community intelligence.** Each verdict compares the quote with an area rate card, blends in what other travellers actually paid, and is raised one level where several different travellers have reported scams nearby.
2. **Every verdict explains its reasoning.** There is no bare score. The card lists factual reasons built in code, plus a plain-language explanation that an AI may only reword (every number it writes is checked).

> **Data honesty:** all rate cards in this prototype are **placeholders** marked "Demo estimate" in the UI, and the 100 seed reports are synthetic (`is_seed = true`). See [Data honesty](#data-honesty).

## What it does

| Screen | What you can do |
|---|---|
| **Check** (`/`) | Pick the ride type, pickup and drop (popular places, search or tap the map), time and quoted price. Get **Fair / Suspicious / High risk** with the fair price range, reasons, an explanation, and confidence, source and distance badges. **Try a demo** fills in four preset trips. |
| **Show the driver** | Full-screen, high-contrast card with the fair range and a polite line in English, Assamese, Bengali or Hindi. Keeps the screen awake. |
| **Report** (`/report`) | Report what you paid or flag a scam (tag chips, short description, optional photo). Phone and vehicle numbers are removed automatically; photos stay private. "Me too" on nearby reports. |
| **Map** (`/map`) | Scam hotspots (3+ different travellers within 500 m in 90 days) with a service filter, plus an accessible list of the same hotspots. |
| **About** (`/about`) | How scoring works, with every threshold read live from `lib/config.ts`. |
| **Offline** | Installable PWA. With no connection, fare checks give a labelled offline estimate and reports are queued until you're back online. |

## Quick start

Requirements: **Node 24** and free accounts (no card needed) for Supabase, plus optionally OpenRouteService and Groq.

```bash
npm install
cp .env.example .env.local      # then fill in the values below
```

1. **Database:** create a free Supabase project. In **SQL Editor**, run `supabase/migrations/001_init.sql`, then `supabase/seed.sql`. Recommended project settings: Data API on, "automatically expose new tables" **off**, automatic RLS on.
2. **Check it:** `npm run db:check` should end with "All checks passed".
3. **Run:** `npm run dev` and open http://localhost:3000.
4. **Production / offline testing:** the service worker only runs in production builds:
   ```bash
   npm run build && npm start
   ```

5. **Deploy:** see [docs/DEPLOY.md](docs/DEPLOY.md) (GitHub → Vercel Hobby, region Mumbai, environment variables, security checks, phone checklist).

### Environment variables

All are server-only (never prefixed `NEXT_PUBLIC_`). Real values go in `.env.local`, which is gitignored.

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL, e.g. `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | yes | Secret (service role) key. Server only. |
| `ORS_API_KEY` | no | OpenRouteService road distances. Without it: straight line × 1.3, labelled "estimate". |
| `LLM_BASE_URL` | no | Any OpenAI-compatible endpoint. Default Groq: `https://api.groq.com/openai/v1` |
| `LLM_API_KEY` | no | Free Groq key. Without it: template explanations. |
| `LLM_MODEL` | no | Default `qwen/qwen3.8-27b` (check Groq's current model list) |
| `LLM_REASONING_EFFORT` | no | `none` for Qwen 3, `low` for gpt-oss models |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (no service worker) |
| `npm run build` / `npm start` | Production build and server (with service worker) |
| `npm run check` | Lint + typecheck + all tests |
| `npm run db:check` | Row counts, seed sanity, private bucket, hotspot check |
| `npm run rls:check` | Tries to read and write everything with the **public** key; all must be blocked (needs `SUPABASE_PUBLISHABLE_KEY` in `.env.local`) |
| `npm run icons` | Re-render the PWA icons from `public/icons/icon.svg` |

## Architecture

```mermaid
flowchart LR
  subgraph Phone["Traveller's phone"]
    UI["Next.js app (React)<br/>Check · Report · Map · About"]
    SW["Service worker (Serwist)<br/>app shell cache"]
    LS[("localStorage<br/>device ID · offline pack · report queue")]
    UI <--> LS
    UI -. offline .-> OFF["Offline check<br/>(same scoring engine)"]
  end

  subgraph Server["Next.js route handlers (Vercel)"]
    CHECK["POST /api/check"]
    EXPLAIN["POST /api/explain"]
    REPORTS["/api/reports · /nearby · /vote · /upload-url"]
    OTHER["/api/places · /geocode · /distance<br/>/hotspots · /offline-pack"]
    LIB["lib/ (pure, unit-tested)<br/>scoring · explain + number guard<br/>hotspots · redact · geo"]
    CHECK --> LIB
    EXPLAIN --> LIB
    REPORTS --> LIB
    OTHER --> LIB
  end

  UI -- "fetch + x-device-id" --> CHECK
  UI --> EXPLAIN
  UI --> REPORTS
  UI --> OTHER
  SW -.-> UI
  LIB -- "secret key (service role)" --> DB[("Supabase Postgres<br/>RLS on, no public policies")]
  REPORTS -- "issues signed upload URL" --> ST[("Supabase Storage<br/>private 'evidence' bucket")]
  UI -- "photo PUT to signed URL only" --> ST
  OTHER --> ORS["OpenRouteService<br/>road distance"]
  OTHER --> NOM["Nominatim<br/>place search"]
  EXPLAIN --> GROQ["Groq (free LLM)"]
  UI --> OSM["OpenStreetMap tiles"]
```

- **The browser never talks to the database.** Every read and write goes through route handlers using the secret key. RLS is on for every table with no public policies, so the public keys can do nothing. The one exception is evidence photos: the browser uploads one file to a single-use signed URL, and nothing in that bucket can be read back.
- **Business logic lives in `lib/`** as pure functions with unit tests; route handlers stay thin. The scoring engine (`lib/scoring.ts`) runs unchanged on the server and, for offline estimates, in the browser.
- **Every external service has a free fallback:** ORS → straight line × 1.3; Groq → template; Nominatim → the seeded place list; network → offline estimate and report queue.

```
app/            pages, route handlers (app/api), service worker (app/sw.ts), manifest
components/     UI: fare check, verdict card, place picker, report, map, driver card
lib/            scoring, explain, number guard, hotspots, redact, geo, distance, config
lib/server/     database access (server-only)    lib/client/  browser helpers
supabase/       001_init.sql (schema, RLS, bucket) · seed.sql (areas, places, rates, reports)
tests/          Vitest unit tests            docs/PLAN.md  build log and decisions
```

## How scoring works

Full plain-language version with live numbers: **`/about`**. In short (all thresholds live in `lib/config.ts`):

1. **Distance:** OpenRouteService road distance; otherwise straight line × 1.3 (labelled estimate).
2. **Rate card:** `expected = max(min_fare, base_fare + per_km_rate × km)`, × the night multiplier between 22:00 and 05:00 IST. Guides use a half-day or full-day rate.
3. **Community blend:** with ≥ 5 similar non-scam reports (same area and service, distance ±20 %, last 180 days), each scaled to this distance: `expected = (1 − w) × rate card + w × median`, `w = min(0.5, n / 20)`.
4. **Verdict:** `ratio = quote ÷ expected`. ≤ 1.20 Fair, ≤ 1.60 Suspicious, above that High risk.
5. **Community escalation:** ≥ 3 scam reports from ≥ 3 different devices within 500 m of the pickup in 90 days raises the verdict one level (never above High risk), with a reason saying why.
6. **Fair range:** expected × 0.90 to × 1.15, rounded to ₹10.
7. **Confidence:** High = area rate card + ≥ 5 reports; Medium = area rate card; Low = regional default.

**Explanation:** a free LLM (Groq) gets the verdict JSON and must write 2–3 sentences plus one polite tip. Every number in its reply is extracted and checked against the verdict, allowing for rounding; accusing or legal wording is rejected; there is a 6-second limit. Any failure shows the deterministic template instead.

## Data honesty

- **Rate cards are placeholders** (`source = 'demo_estimate'`, note "Replace with official fare chart"). The UI shows a "Demo estimate" badge on every verdict and the driver card says "demo estimate". To use real fares, edit the table at the top of `supabase/seed.sql` and set `source = 'official'` with the notification as `source_note`.
- **Seed reports are synthetic** (`is_seed = true`, device IDs start with `5eed0000-`): 70 normal fares and 30 scams with hotspots at Guwahati Railway Station and the airport. They exist to demonstrate the community features.
- **Place coordinates** come from OpenStreetMap (element IDs in `seed.sql`). Not fully verified: which Guwahati airport terminal handles arrivals, Pakyong's terminal (unmapped), and Police Bazar (street centre).
- **Translations** on the driver card are first drafts marked "needs native speaker review" in `lib/i18n/driver-card.json`.

## Security checks

- **No secret reaches the browser:** the client bundle, prerendered pages, service worker and `public/` were scanned for every key name, every key value and the `sb_secret_` / `gsk_` prefixes. All clean. Git history contains no secret values.
- **Database lock-down:** RLS on every table, no policies, no grants for `anon`/`authenticated`. Verify with `supabase/checks/verify-security.sql` (SQL Editor) and `npm run rls:check`.

## Privacy and safety

- No accounts and no personal data. A random device ID (localStorage) is used only for rate limits (30 checks and 5 reports per hour) and "Me too" votes.
- We flag places and patterns, never people: phone numbers and vehicle registration numbers are stripped from report text on the server, and the UI asks people not to include names.
- Evidence photos are compressed on the phone (which also strips EXIF/GPS), stored in a private bucket, and never displayed; the UI only says "evidence attached".
- Map location (if allowed) stays in the browser.

## Known limitations

- **Placeholder rate cards:** verdicts are a guide until official fare charts are added.
- **Spoofable device ID:** anyone can clear or forge it, so one person could pose as several travellers. Rate limits and the 3-traveller rule reduce, but don't remove, this risk.
- **Small community sample:** real reports are few, so most checks use the rate card alone.
- **Hill roads:** when road distance is unavailable, straight line × 1.3 can be about half the real distance in Gangtok and Tawang.
- **Route-based fares:** shared taxis often charge a fixed fare per seat per route, which the per-km model only approximates.
- **Free-tier limits:** Groq's per-minute limit falls back to the template; Nominatim's 1 request/second and some rate limits are per server instance.
- **Offline estimates** have no community data or warnings.

## Quality

- **Tests:** Vitest unit tests for scoring, time windows, distance, number guard, explanations, redaction, hotspots, offline check, report queue, demo scenarios and more (`npm test`).
- **Lighthouse (mobile, production build):** accessibility 100 on every page; performance 92–99, except `/map` at about 88 because its largest element is a third-party map tile.
- **Accessibility:** every control has a label, visible focus rings, WCAG AA contrast, and verdicts always pair colour with an icon and text.

## Demo script (2 minutes)

1. **Check → Try a demo → "High-risk ride from the station" → Check this fare.** High risk, ₹400 against about ₹163, plus "9 scam reports from 4 different travellers within 500 m" (pricing data + community intelligence, explained).
2. **Show the driver** → switch to অসমীয়া / বাংলা / हिन्दी.
3. **Try a demo → "Suspicious airport taxi"** → Suspicious, blended with 11 traveller reports (High confidence).
4. **Map** → the two hotspots, with the same counts as the verdict card.
5. **About** → the formula and thresholds, live from config.
6. Optional: DevTools → Network → **Offline**, run a check → "Offline estimate, community data not included".

## Credits

Map data and place search © OpenStreetMap contributors (ODbL). Road distances by OpenRouteService. Fonts: Noto Sans family (SIL OFL). Built with Next.js, Supabase, Leaflet, Serwist and zod.
