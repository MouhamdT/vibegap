# VibeGap — Goal-first place decision analytics

VibeGap is a Next.js / TypeScript MVP that helps you **choose places** from a travel or visit plan—not only by star ratings, but by **goal fit**, **risk read from reviews**, **confidence**, **distance and landmark context**, and **explainable tradeoffs**.

It parses natural queries such as:

- "brunch near Trevi Fountain"
- "quiet place to study in Tel Aviv"
- "cheap birthday dinner London"
- "Nobu London vs Sketch for birthday dinner"

The app uses **Google Places** (Places API New) for place discovery and details, **signals from available Google reviews** where the API returns them, and **scoring based on clear rules and your visit goal** on the server. There is **no** integration with TikTok, Instagram, live social feeds, or scraped social trend data.

## Key features

- **Goal / query understanding** — Classifies intent (recommendation vs single venue vs compare) and extracts goals, locations, and modifiers from free text.
- **Recommendation mode** — Ranks a shortlist of candidates for a plan in a geographic or landmark context.
- **Single venue check** — Deep report for one named venue with decision labels and evidence-oriented copy.
- **Compare mode** — Side-by-side comparison for two venues with a shared goal when the query asks for it.
- **Candidate quality gate** — Filters or downgrades weak intent matches before final ranking so the shortlist stays goal-relevant.
- **Reliable / Balanced / Discovery** — Local ordering styles on the same candidate set (emphasis on established signals versus more exploratory picks); no extra network calls.
- **Curated shortlist roles** — Labels such as best overall, safest choice, closest to anchor, best value, and fresh pick where signals support them.
- **Tune Ranking priorities** — User-adjustable weights that reorder the shortlist within the same scored pool.
- **Review Evidence** — Surfaces themes and excerpts from reviews when Google returns usable review text.
- **Distance / landmark intelligence** — Approximate distances from anchors or search centers; optional nearby landmark context on the map when configured.
- **Decision Map** — Ranked pins, selection sync, and map UI powered by the Google Maps JavaScript API when keys are present.
- **Explainable GO / MAYBE / SKIP** — Each candidate carries rationale, risks, and score breakdowns aligned to the decision label.

## How it works

1. **Parse user intent** — The server classifies the query mode and extracts goal text, location hints, compare pairs, and routing context.
2. **Generate or resolve candidates** — Google Places text search (and related flows) produce or narrow a candidate pool for recommendations; single venue and compare paths resolve named venues.
3. **Candidate quality gate** — Deterministic checks down-rank or filter poor goal fits when stronger alternatives exist in the pool.
4. **Extract review themes / signals** — Review snippets and themes are derived from **available** Google review payload for each place (not from external social APIs).
5. **Scoring tied to the goal** — Fit scores combine intent alignment, review signals, price and operational cues, and geography where applicable.
6. **Recommendation style and tuning** — Optional style (Reliable / Balanced / Discovery) and Tune Ranking sliders apply **local** reordering on top of gated scores.
7. **Curated shortlist** — Top candidates receive shortlist roles and human-readable explanations (best for, main risk, role rationale).
8. **Review evidence and map context** — The UI shows review evidence panels and a decision map when coordinates and API keys allow.

## Data honesty

- **Google Places** supplies place identity, ratings, coordinates, and other fields returned by the configured Places API New requests.
- **Rankings are deterministic** and use **clear scoring rules**; they follow the visit goal and can be tuned, and they are not a black-box ML model in this repo.
- **Distances** shown in the product are **approximate** and based on available coordinate / map context.
- **Review evidence** depends on what Google returns for that place in the current integration; some venues may have thin or no review text in the response.
- **No live social media scraping**, **no social trend analysis**, and **no TikTok/Instagram/reel data** are used in the current product path.

## Tech stack

- **Next.js** (App Router) — server routes for vibecheck and related APIs.
- **React** + **TypeScript**
- **Google Places API (New)** — `places.googleapis.com/v1` for text search, place details, and nearby search where used.
- **Google Maps JavaScript API** — client-side map modal and markers when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.
- **Tailwind CSS v4** — styling via `app/globals.css` (`@import "tailwindcss"`) with PostCSS (`@tailwindcss/postcss`), plus a small amount of global CSS for component-specific touches.

## Environment variables

Create a **`.env.local`** file in the project root (do **not** commit it). Example shape—**replace values** with your own keys and map ID:

```bash
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=DEMO_MAP_ID
```

| Variable | Role |
|----------|------|
| `GOOGLE_PLACES_API_KEY` | **Server-only.** Used from API routes and server code; never prefixed with `NEXT_PUBLIC_`, so it is not exposed to the browser bundle. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Loaded in the client for the Maps JS API. Treat as **browser-visible**; restrict it in Google Cloud (e.g. **HTTP referrers** for your dev and production origins). |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Map ID for vector / styled maps when using the Maps JavaScript API. |

Keep `.env.local` out of version control (it should already be gitignored).

## Local setup

```bash
npm install
npm run dev
```

The app runs at **http://localhost:3000**.

Production build:

```bash
npm run build
```

Other scripts: `npm run start` (after build), `npm run lint`, `npm run test` (deterministic query/compare routing checks).

## Example searches

**Recommendations**

- brunch near Trevi Fountain
- quiet place to study in Tel Aviv
- cheap birthday dinner London
- fancy restaurant in Rome but cheap

**Single-place**

- Nobu London
- Piccolo Buco Rome no waiting time

**Compare**

- Nobu London vs Sketch for birthday dinner

## Current limitations

- **No live social media or trend data** — positioning and “vibe” language in the app come from query parsing, Places fields, and signals drawn from available reviews, not from social scraping.
- **Review freshness** depends on Google’s data and what the Places responses include for each venue.
- **Venue and menu detail** may be incomplete when Google does not return those fields for a given request.
- **Discovery style** re-weights candidates using **existing** venue and review signals only; it does not discover venues from social platforms.
- **Maps** require a valid Maps JavaScript API key (and appropriate billing/API enablement in Google Cloud); without them, map UI may be limited or unavailable.

## Next steps

- Recommendation quality audit across query families and cities.
- Stronger compare-mode parsing and copy when goals or cities are implicit.
- Richer **freshness / recency** signals where review timestamps or metadata are available from the provider.
- Better use of **hours, reservations, and menu** signals when Places returns them reliably.
- More **automated query evaluation** tests for routing and ranking regressions.
