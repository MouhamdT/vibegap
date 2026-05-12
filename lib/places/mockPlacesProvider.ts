import type { PlaceData, PriceLevel, QueryMode, ReviewTheme, UserIntentKind } from "@/lib/types/vibecheck";

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length] as T;
}

function titleCaseName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function inferCategory(q: string, seed: number): string {
  const lower = q.toLowerCase();
  if (/\b(cafe|coffee|espresso|latte|roast)\b/.test(lower)) return "Café";
  if (/\b(bar|brewery|wine|cocktail|pub)\b/.test(lower)) return "Bar";
  if (/\b(hotel|inn|lodge|resort)\b/.test(lower)) return "Hotel";
  if (/\b(bakery|boulangerie|patisserie)\b/.test(lower)) return "Bakery";
  if (/\b(brunch|bistro|restaurant|grill|kitchen|club|dinner|supper)\b/.test(lower)) return "Restaurant";
  const cats = ["Restaurant", "Café", "Wine bar", "Neighborhood eatery"] as const;
  return pick(cats, seed);
}

const GOAL_STUDY_CATS = ["Café", "Study café"] as const;
const GOAL_PARTY_CATS = ["Bar", "Night lounge", "Nightclub"] as const;
const GOAL_BUDGET_REST_CATS = ["Casual restaurant", "Neighborhood restaurant"] as const;
const GOAL_DATE_CATS = ["Wine bar", "Bistro", "French bistro"] as const;
const GOAL_LUXURY_CATS = ["Fine dining restaurant", "Chef's table restaurant"] as const;
const GOAL_FAMILY_CATS = ["Family restaurant", "Casual restaurant"] as const;

/** Illustrative category for goal_search — matches the parsed intent, not a random wine bar. */
function categoryForGoalIntent(kind: UserIntentKind, seed: number): string {
  switch (kind) {
    case "study_work":
    case "quiet_calm":
      return pick(GOAL_STUDY_CATS, seed);
    case "party_nightlife":
      return pick(GOAL_PARTY_CATS, seed);
    case "budget_celebration":
    case "budget_eats":
      return pick(GOAL_BUDGET_REST_CATS, seed);
    case "date_night":
      return pick(GOAL_DATE_CATS, seed);
    case "luxury":
      return pick(GOAL_LUXURY_CATS, seed);
    case "family":
      return pick(GOAL_FAMILY_CATS, seed);
    default:
      return pick(["Restaurant", "Café", "Neighborhood eatery"], seed);
  }
}

/** When a region token appears in the query, the mock address follows that geography (still fictional). */
const MOCK_REGION_ROWS: readonly { pattern: RegExp; line1: string; line2: string }[] = [
  {
    pattern: /\btulum\b/i,
    line1: "Calle Centauro Sur (mock)",
    line2: "Coastal road · Tulum, Quintana Roo, Mexico",
  },
  {
    pattern: /\b(cancun|cancún|playa del carmen)\b/i,
    line1: "Boulevard Kukulcán km 12 (mock)",
    line2: "Hotel Zone · Cancún, Quintana Roo, Mexico",
  },
  {
    pattern: /\b(miami|south beach|wynwood)\b/i,
    line1: "NE 41st Street (mock)",
    line2: "Design District · Miami, FL, USA",
  },
  {
    pattern: /\b(nyc|new york|manhattan|brooklyn|queens)\b/i,
    line1: "Mercer Street (mock)",
    line2: "SoHo · New York, NY, USA",
  },
  {
    pattern: /\b(london|shoreditch|soho)\b/i,
    line1: "Rivington Street (mock)",
    line2: "Shoreditch · London, UK",
  },
  {
    pattern: /\b(paris|marais|montmartre)\b/i,
    line1: "Rue des Archives (mock)",
    line2: "Le Marais · Paris, France",
  },
  {
    pattern: /\b(tokyo|shibuya|shinjuku)\b/i,
    line1: "Cat Street (mock)",
    line2: "Harajuku · Tokyo, Japan",
  },
  {
    pattern: /\b(austin|atx)\b/i,
    line1: "East 6th Street (mock)",
    line2: "East Austin · Austin, TX, USA",
  },
  {
    pattern: /\b(seattle|capitol hill)\b/i,
    line1: "Pine Street (mock)",
    line2: "Downtown · Seattle, WA, USA",
  },
  {
    pattern: /\b(portland|pdx)\b/i,
    line1: "NW 23rd Avenue (mock)",
    line2: "Nob Hill · Portland, OR, USA",
  },
  {
    pattern: /\b(los angeles|la\b|weho|silverlake)\b/i,
    line1: "Sunset Boulevard (mock)",
    line2: "Silver Lake · Los Angeles, CA, USA",
  },
  {
    pattern: /\b(san francisco|sf\b|mission)\b/i,
    line1: "Valencia Street (mock)",
    line2: "Mission · San Francisco, CA, USA",
  },
  {
    pattern: /\b(chicago|wicker|loop)\b/i,
    line1: "Milwaukee Avenue (mock)",
    line2: "Wicker Park · Chicago, IL, USA",
  },
  {
    pattern: /\b(nashville)\b/i,
    line1: "Broadway (mock)",
    line2: "Downtown · Nashville, TN, USA",
  },
  {
    pattern: /\b(denver)\b/i,
    line1: "Larimer Street (mock)",
    line2: "RiNo · Denver, CO, USA",
  },
  {
    pattern: /\b(barcelona|eixample)\b/i,
    line1: "Carrer del Consell de Cent (mock)",
    line2: "Eixample · Barcelona, Spain",
  },
  {
    pattern: /\b(sedona)\b/i,
    line1: "State Route 89A (mock)",
    line2: "Uptown · Sedona, AZ, USA",
  },
];

const MOCK_STREET_NAMES = [
  "Marigold Lane",
  "Riverside Walk",
  "Harbor Court",
  "Cedar Commons",
  "Market Alley",
  "Station Row",
] as const;

/**
 * Invented street near the user's search text — never implies a real geocode.
 */
function buildMockAddress(query: string, displayName: string, hash: number, queryMode?: QueryMode): string {
  if (queryMode === "goal_search") {
    return "Imaginary map pin (mock) · Illustrative only — not geocoded as a real address for your text";
  }
  const q = query.trim();
  for (const row of MOCK_REGION_ROWS) {
    if (row.pattern.test(q)) {
      return `${row.line1} · ${row.line2}`;
    }
  }

  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const anchor = words.slice(0, Math.min(4, words.length)).join(" ");
  const street = pick(MOCK_STREET_NAMES, hash);
  const number = 40 + (hash % 860);
  return `${number} ${street} (mock) · Illustrative address near “${anchor}” — not geocoded`;
}

function buildThemes(seed: number, reviewCount: number): ReviewTheme[] {
  const pool: ReviewTheme[] = [
    { id: "food", label: "Food quality", sentiment: "positive", strength: 55 + (seed % 35) },
    { id: "noise", label: "Noise level", sentiment: "negative", strength: 40 + (seed % 40) },
    { id: "service", label: "Service speed", sentiment: "mixed", strength: 35 + (seed % 45) },
    { id: "value", label: "Value for money", sentiment: "mixed", strength: 45 + (seed % 30) },
    { id: "ambience", label: "Ambience & design", sentiment: "positive", strength: 50 + (seed % 25) },
    { id: "wait", label: "Wait times", sentiment: "negative", strength: 30 + (seed % 50) },
    {
      id: "crowd",
      label: "Crowding",
      sentiment: reviewCount > 900 ? "negative" : "mixed",
      strength: 38 + (seed % 42),
    },
  ];
  const start = seed % 3;
  return pool.slice(start, start + 5);
}

export type MockPlaceOptions = {
  queryMode: QueryMode;
  placeNameCandidate: string | null;
  /** When `queryMode` is goal_search, aligns mock venue category with this intent. */
  goalIntentKind?: UserIntentKind;
};

/**
 * Returns realistic mock place data derived deterministically from the search string.
 * `opts` adjusts naming for goal vs named-venue flows (V2.5).
 */
export function getMockPlaceForQuery(query: string, opts?: MockPlaceOptions): PlaceData {
  const trimmed = query.trim();
  const key = trimmed.toLowerCase();
  const hash = djb2(key || "vibegap-default");
  const category =
    opts?.queryMode === "goal_search" && opts.goalIntentKind
      ? categoryForGoalIntent(opts.goalIntentKind, hash)
      : inferCategory(key, hash);

  let name: string;
  const mockGoalIntentKind: UserIntentKind | undefined =
    opts?.queryMode === "goal_search" && opts.goalIntentKind ? opts.goalIntentKind : undefined;
  if (opts?.queryMode === "goal_search") {
    name = `Illustrative ${category.toLowerCase()} · goal check (mock)`;
  } else if (opts?.queryMode === "place_with_intent" && opts.placeNameCandidate?.trim()) {
    name = titleCaseName(opts.placeNameCandidate.trim());
  } else {
    name = trimmed ? titleCaseName(trimmed) : "Riverbend Café";
  }

  const reviewCount = 180 + (hash % 2400);
  const averageRating = Math.round((32 + (hash % 14)) / 10 * 10) / 10;
  const priceLevel = (1 + (hash % 4)) as PriceLevel;
  const themes = buildThemes(hash, reviewCount);

  const busyComplaintsPool = [
    "Weekend lines stretch onto the sidewalk.",
    "Tables turn slowly when it is busy.",
    "Music is loud during peak dinner hours.",
    "Hard to hear conversation on Friday nights.",
    "Reservations rarely available same-day.",
    "Packed house on Saturday nights — expect a wait.",
  ];
  const neutralComplaintsPool = [
    "Parking validation is confusing after 9pm.",
    "The menu rotates often between visits.",
    "Outdoor heaters can be inconsistent in winter.",
    "Some tables feel a bit tight for larger parties.",
    "Photos on the menu do not always match plating.",
    "Service pacing can feel rushed during turnover.",
  ];
  const complaintsPool = hash % 4 === 0 ? neutralComplaintsPool : busyComplaintsPool;
  const positivesPool = [
    "Consistently praised signature dishes.",
    "Friendly staff when you get a table.",
    "Great natural light earlier in the day.",
    "Strong espresso program.",
    "Outdoor seating is a highlight in good weather.",
    "Wine list punches above its weight.",
    "Good for a quick solo lunch on weekdays.",
  ];

  const complaints = [
    pick(complaintsPool, hash),
    pick(complaintsPool, hash >> 2),
    pick(complaintsPool, hash >> 4),
  ].filter((c, i, a) => a.indexOf(c) === i);

  const positives = [
    pick(positivesPool, hash >> 1),
    pick(positivesPool, hash >> 3),
    pick(positivesPool, hash >> 5),
  ].filter((c, i, a) => a.indexOf(c) === i);

  const recentReviewSummary = `Recent reviews emphasize ${themes[0]?.label.toLowerCase() ?? "the experience"} and ${themes[1]?.label.toLowerCase() ?? "service"}. Guests often mention ${complaints[0]?.toLowerCase() ?? "busy periods"} while still highlighting ${positives[0]?.toLowerCase() ?? "standout details"}.`;

  return {
    id: `mock-${hash.toString(36)}`,
    name,
    address: buildMockAddress(trimmed, name, hash, opts?.queryMode),
    category,
    averageRating,
    reviewCount,
    priceLevel,
    reviewThemes: themes,
    recentReviewSummary,
    complaints,
    positives,
    ...(mockGoalIntentKind ? { mockGoalIntentKind } : {}),
  };
}
