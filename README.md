# Travel Trap Detector

Hackathon prototype for CodeWar 8.0, Problem 5. A mobile-first web app that tells travellers in North East India whether a quoted fare for an auto, taxi, bike taxi, shared Sumo seat or local guide looks fair, and explains why.

Status: in progress. See [docs/PLAN.md](docs/PLAN.md) for the build checklist and [docs/SPEC.md](docs/SPEC.md) for the spec.

## Run locally

Requires Node 24.

```bash
npm install
cp .env.example .env.local   # fill in values; all services are free tiers
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest unit tests |
| `npm run check` | All three of the above |

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase (Postgres + Storage), Leaflet + OpenStreetMap, OpenRouteService, Groq (free tier, optional). Zero cost: every external service is a free tier, and each one has a fallback.

## Known limitations

More detail will come as phases land. Already known: the device ID is a random UUID in localStorage and can be spoofed. That's acceptable for an MVP with no user accounts.
