# Deploying Travel Trap Detector

Everything here is free: GitHub (free account), Vercel Hobby (no card), and the existing Supabase, OpenRouteService and Groq free tiers.

## 1. Before you deploy

- [ ] `npm run check` passes (lint, typecheck, tests).
- [ ] `npm run db:check` prints "All checks passed".
- [ ] Security check in Supabase → SQL Editor: run `supabase/checks/verify-security.sql`. Every table must show `rls_enabled = true`, `policies = 0`, and all four `anon_…` / `authenticated_…` columns `false`; the `evidence` bucket must be `public = false`.
- [ ] Optional behavioural check: add the **publishable** key to `.env.local` as `SUPABASE_PUBLISHABLE_KEY`, then `npm run rls:check`. It must end with "All blocked".
- [ ] **Rotate the Supabase secret key** if it was ever pasted anywhere outside `.env.local` (chat, screenshots, `.env.example`): Supabase → Project Settings → API Keys → create a new secret key, put it in `.env.local` (and in Vercel below), then delete the old one.

## 2. Put the code on GitHub

1. On github.com, create a **new private repository** called `travel-trap-detector`. Leave "Add a README" unticked.
2. In the project folder:
   ```bash
   git remote add origin https://github.com/<your-username>/travel-trap-detector.git
   git push -u origin main
   ```
   `.env.local` is gitignored and never leaves your computer. Only `.env.example` (no values) is pushed.

## 3. Create the Vercel project

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub**. Choose the **Hobby** plan (free).
2. **Add New… → Project** → find `travel-trap-detector` → **Import**. If the repo isn't listed, click "Adjust GitHub App Permissions" and give Vercel access to it.
3. On the configure screen:
   - **Framework Preset:** Next.js (detected automatically).
   - **Root Directory:** `./`. **Build / Install commands:** leave the defaults.
4. Open **Environment Variables** and add these (tick Production and Preview):

| Name | Value | Secret? |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Not secret, but server-only |
| `SUPABASE_SECRET_KEY` | your `sb_secret_…` key | **SECRET**: full database access. Mark **Sensitive**. |
| `ORS_API_KEY` | your OpenRouteService key | **SECRET** (quota). Mark **Sensitive**. |
| `LLM_API_KEY` | your Groq `gsk_…` key | **SECRET** (quota). Mark **Sensitive**. |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Not secret |
| `LLM_MODEL` | `qwen/qwen3.8-27b` | Not secret |
| `LLM_REASONING_EFFORT` | `none` | Not secret |

   Rules:
   - **Never** give any of these a `NEXT_PUBLIC_` prefix: that would put them in the browser bundle.
   - **Don't** add `SUPABASE_PUBLISHABLE_KEY`; the app never uses it.
5. Click **Deploy**. The build takes about 1–2 minutes. The log should include `(serwist) … precache entries` and list `● /serwist/sw.js` (the service worker is built once, at build time).
6. When it's done, Vercel shows the URL, e.g. `https://travel-trap-detector.vercel.app`.

## 4. After the first deploy

- [ ] **Settings → Functions → Function Region** shows **Mumbai (bom1)**, set by `vercel.json` so the server sits next to the Supabase database (also in Mumbai).
- [ ] Open the URL and run the four demos ("Try a demo"). Expected: Fair, Suspicious, High risk, Suspicious.
- [ ] **Logs** tab: no errors after using the app. Lines like "Distance fallback" or "Explanation fallback" mean a key is missing or wrong.
- [ ] Every `git push` to `main` now redeploys automatically. Pull requests get preview URLs.
- [ ] Supabase free projects pause after about 7 days without activity. Open the app the day before the demo.

## 5. Final test checklist on a real phone

Use the live HTTPS URL; the service worker and screen wake lock need HTTPS.

### A. On a phone over mobile data (Wi-Fi off)
- [ ] **First load:** the home page appears in a few seconds; nothing jumps around as it loads.
- [ ] **Install:** browser menu → **Install app** / **Add to Home Screen**. The teal shield icon appears; it opens full screen with the teal status bar.
- [ ] **Demos:** all four give Fair / Suspicious / High risk / Suspicious. The verdict shows first; the explanation appears a moment later with "AI-written from the numbers above".
- [ ] **Real trip:** choose places three ways: Popular list, Search (type "Kamakhya"), and Map (tap). The distance badge says "by road".
- [ ] **Show the driver:** switch through English, অসমীয়া, বাংলা, हिन्दी. No empty boxes (□) instead of letters. Leave it open for 2 minutes without touching: the screen should **not** dim or lock (Wake Lock). Close with ×.
- [ ] **Report:** send a fare report and a scam report with a photo from the camera. The thank-you screen appears; the report is in "Recent reports within 1 km" with "evidence attached" (never the photo itself).
- [ ] **Privacy:** put a fake phone number (e.g. 98640 12345) in a description. The stored report shows "[removed]".
- [ ] **Me too:** from a second phone, tap "Me too" on that report. A second tap says you've already done it.
- [ ] **Map:** both Guwahati hotspots appear; "Use my location" asks for permission and centres the map; "Show on map" opens the popup.
- [ ] **Accessibility:** turn on TalkBack (Android) or VoiceOver (iPhone) and check a verdict is read as "High risk, This price may be overpriced…". Set the phone's text size to the largest: nothing should be cut off.

### B. Slow 4G (Chrome DevTools on a laptop)
1. Open the live URL in Chrome → **F12** → **device toolbar** (phone icon) → pick a phone around 375 px wide.
2. **Network** tab → tick **Disable cache** → throttling **Slow 4G**.
3. Reload each page.

- [ ] Home: text visible within about 3 s; the form works before the map code has loaded.
- [ ] A fare check returns a verdict; the explanation follows within about 10 s (or the template appears).
- [ ] `/map`: the list and filters appear even while map tiles are still loading.
- [ ] No horizontal scrolling at 375 px on any page.

### C. Offline mode
1. Open the app once online (this saves the app and the rates on the device).
2. DevTools → Network → **Offline** (or airplane mode on the phone), then reload.

- [ ] The app still opens; the dark banner says "You're offline…".
- [ ] A fare check returns a verdict labelled **"Offline estimate, community data not included"**, with an "estimated" distance.
- [ ] Popular places still load in the pickers.
- [ ] A report shows "Report saved on your phone"; the banner counts it.
- [ ] Go back online: within about 30 s the banner says it was sent, and the report appears in "Recent reports within 1 km".
- [ ] A page not opened before shows the "You're offline" page with a link to the fare check.

### D. After testing
Remove your test reports in Supabase → SQL Editor, for example:
```sql
delete from reports where description ilike 'test%';
```
