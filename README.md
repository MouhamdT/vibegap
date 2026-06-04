# VibeGap — Goal-first venue recommendations

VibeGap is a Next.js and TypeScript MVP that helps you choose **venues** for a travel or visit plan. It ranks options by **goal fit**, **review signals**, **confidence**, **distance context**, and **practical tradeoffs** — not just star ratings.

**Example searches**

- brunch near Trevi Fountain
- quiet place to study in Tel Aviv
- cheap birthday dinner London
- Nobu London vs Sketch for birthday dinner

## Key features

- Natural language query parsing
- Recommendation mode (ranked shortlist for a goal and area)
- Single venue check
- Compare mode (two venues, shared goal)
- Candidate quality filtering before ranking
- Reliable / Balanced / Discovery styles (same pool, local ordering)
- Tune ranking controls
- Review evidence (themes and snippets when Google returns text)
- Decision map (Google Maps when configured)
- Explainable GO / MAYBE / SKIP decisions

## How it works

- Parses the visit goal and location from your search
- Uses **Google Places** for venue identity, ratings, and coordinates
- Filters weak matches, then scores candidates from **available Google review signals**, risk, confidence, and location context
- Applies **clear scoring rules** tied to the goal; style and tune controls **reorder** the same results locally (no extra search)
- Presents a ranked shortlist with evidence and map context where data allows

## Tech stack

- Next.js (App Router)
- React
- TypeScript
- Google Places API (New)
- Google Maps JavaScript API
- Tailwind CSS
- Vitest (`npm run test`)

## Environment variables

Create **`.env.local`** in the project root (do not commit it):

```bash
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=DEMO_MAP_ID
```

- **`GOOGLE_PLACES_API_KEY`** — server only; do not prefix with `NEXT_PUBLIC_`.
- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** — used in the browser for Maps; restrict by HTTP referrer in Google Cloud.
- **`NEXT_PUBLIC_GOOGLE_MAP_ID`** — map ID for the Maps JavaScript API.

## Local setup

```bash
npm install
npm run dev
```

```bash
npm run build
```

```bash
npm run test
```

Other scripts: `npm run start` (after build), `npm run lint`.

## Limitations

- Uses Google Places and **available** Google review data only; detail varies by venue and response.
- **No** live TikTok, Instagram, or other social scraping or trend analysis.
- **Distances** in the app are approximate.
- Review depth and freshness depend on what Google returns for each place.

## Next steps

- Expand recommendation evaluation tests.
- Tighten compare mode parsing and copy for edge cases.
- Add freshness signals when review timestamps or metadata are reliably available.
