# VibeGap — Goal-first venue recommendations

Next.js and TypeScript MVP for **travel and visit planning**: rank **venues** by goal fit, **review signals**, confidence, distance context, and tradeoffs—not only star ratings.

**Data note:** VibeGap uses Google Places and available Google review data. It does not use live social media scraping.

**Example searches**

- brunch near Trevi Fountain
- quiet place to study in Tel Aviv
- cheap birthday dinner London
- Nobu London vs Sketch for birthday dinner

## Key features

- Natural language parsing for goals and locations
- **Recommendation mode** — ranked shortlist for a goal and area
- **Single venue check** — one named venue with evidence
- **Compare mode** — two venues, shared goal
- Quality filtering before ranking
- Reliable / Balanced / Discovery (same candidates, local **reorder** only)
- Tune ranking, review evidence, decision map (Google Maps when configured)
- Explainable GO / MAYBE / SKIP

## How it works (short)

Parses your visit goal and location → pulls venue data from Google Places → filters weak fits → scores using **available review signals** and **clear scoring rules** adjusted to the visit goal → shows a shortlist with evidence and map context.

## Tech stack

Next.js (App Router), React, TypeScript, Google Places API (New), Google Maps JavaScript API, Tailwind CSS, Vitest (`npm run test`).

## Environment variables

Create **`.env.local`** in the project root (do not commit it):

```bash
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=DEMO_MAP_ID
```

- **`GOOGLE_PLACES_API_KEY`** — server only; never use `NEXT_PUBLIC_` for this key.
- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** — browser Maps key; restrict by HTTP referrer in Google Cloud.
- **`NEXT_PUBLIC_GOOGLE_MAP_ID`** — map ID for the Maps JavaScript API.

## Local setup

```bash
npm install
npm run dev
npm run build
npm run test
```

Also: `npm run start` (after build), `npm run lint`.
