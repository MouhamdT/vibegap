/**
 * When comparing "Nobu London" vs "Sketch", inherit explicit city from side A
 * so side B resolves in the same metro (Places text search is ambiguous otherwise).
 */

const TWO_WORD_CITIES: readonly string[] = [
  "tel aviv",
  "new york",
  "los angeles",
  "san francisco",
  "hong kong",
  "las vegas",
  "san diego",
  "buenos aires",
  "kuala lumpur",
  "mexico city",
  "new orleans",
  "salt lake city",
  "rio de janeiro",
];

const ONE_WORD_CITIES = new Set([
  "london",
  "rome",
  "paris",
  "milan",
  "berlin",
  "dublin",
  "edinburgh",
  "madrid",
  "barcelona",
  "vienna",
  "prague",
  "warsaw",
  "amsterdam",
  "brussels",
  "copenhagen",
  "stockholm",
  "oslo",
  "helsinki",
  "dubai",
  "singapore",
  "tokyo",
  "osaka",
  "seoul",
  "sydney",
  "melbourne",
  "brisbane",
  "perth",
  "chicago",
  "boston",
  "denver",
  "houston",
  "dallas",
  "miami",
  "atlanta",
  "philadelphia",
  "seattle",
  "portland",
  "austin",
  "phoenix",
  "toronto",
  "vancouver",
  "montreal",
  "munich",
  "frankfurt",
  "hamburg",
  "haifa",
  "cologne",
  "naples",
  "florence",
  "venice",
  "bucharest",
  "budapest",
  "istanbul",
  "athens",
  "lisbon",
  "geneva",
  "zurich",
  "lyon",
  "marseille",
  "bruges",
  "antwerp",
  "glasgow",
  "manchester",
  "liverpool",
  "bristol",
  "cardiff",
  "birmingham",
  "rotterdam",
]);

/** Longer multi-word city tokens first so suffixes like "in mexico city" match correctly. */
const TWO_WORD_CITIES_BY_SUFFIX_LENGTH: readonly string[] = [...TWO_WORD_CITIES].sort(
  (a, b) => b.length - a.length,
);

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Strips only an articulated `… in <known city>` suffix (not `Nobu London`-style direct suffixes).
 * Used when parsing compare venue segments so `"coco in haifa"` becomes venue `coco` + city `Haifa`.
 */
export function stripExplicitInCitySuffixFromPlaceQuery(segment: string): {
  venue: string;
  cityDisplay: string | null;
} {
  const q = segment.trim();
  if (!q) return { venue: q, cityDisplay: null };
  const lower = q.toLowerCase();

  for (const pair of TWO_WORD_CITIES_BY_SUFFIX_LENGTH) {
    const suf = ` in ${pair}`;
    if (lower.endsWith(suf)) {
      return {
        venue: q.slice(0, q.length - suf.length).trim(),
        cityDisplay: titleCaseWords(pair),
      };
    }
  }

  for (const city of ONE_WORD_CITIES) {
    const suf = ` in ${city}`;
    if (lower.endsWith(suf)) {
      return {
        venue: q.slice(0, q.length - suf.length).trim(),
        cityDisplay: city[0]!.toUpperCase() + city.slice(1).toLowerCase(),
      };
    }
  }

  return { venue: q, cityDisplay: null };
}

/**
 * When a whole compare query ends with `… in <city>` (shared metro), strip it before splitting on `vs`.
 * Skips ambiguous tails like `… for dinner in rome` where `in rome` belongs to the goal phrase.
 */
export function extractTrailingCompareLocationSuffix(fullQuery: string): {
  rest: string;
  cityDisplay: string | null;
} {
  const q = fullQuery.trim();
  if (!q) return { rest: q, cityDisplay: null };
  const lower = q.toLowerCase();

  if (/\s+for\s+.+\s+in\s+[a-z][a-z\s-]+$/i.test(q)) {
    return { rest: q, cityDisplay: null };
  }

  for (const pair of TWO_WORD_CITIES_BY_SUFFIX_LENGTH) {
    const suf = ` in ${pair}`;
    if (lower.endsWith(suf)) {
      const rest = q.slice(0, q.length - suf.length).trim();
      if (/\s+vs\.?\s+|\s+versus\s+/i.test(rest)) {
        return { rest, cityDisplay: titleCaseWords(pair) };
      }
    }
  }

  for (const city of ONE_WORD_CITIES) {
    const suf = ` in ${city}`;
    if (lower.endsWith(suf)) {
      const rest = q.slice(0, q.length - suf.length).trim();
      if (/\s+vs\.?\s+|\s+versus\s+/i.test(rest)) {
        return { rest, cityDisplay: city[0]!.toUpperCase() + city.slice(1).toLowerCase() };
      }
    }
  }

  return { rest: q, cityDisplay: null };
}

/** Splits a trailing known city (either `… in <city>` or a direct suffix like `Nobu London`). */
export function splitVenueAndTrailingCity(placeQuery: string): { cleanVenue: string; cityDisplay: string | null } {
  const articulated = stripExplicitInCitySuffixFromPlaceQuery(placeQuery);
  if (articulated.cityDisplay) {
    return { cleanVenue: articulated.venue, cityDisplay: articulated.cityDisplay };
  }

  const raw = articulated.venue.trim();
  const t = raw.toLowerCase();
  if (!t) return { cleanVenue: raw, cityDisplay: null };

  for (const pair of TWO_WORD_CITIES) {
    if (t.endsWith(pair)) {
      const before = t.slice(0, t.length - pair.length).trim();
      if (before.length < 2) continue;
      const venue = raw.slice(0, t.length - pair.length).trim();
      return { cleanVenue: venue, cityDisplay: titleCaseWords(pair) };
    }
  }

  const words = t.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  if (!last) return { cleanVenue: raw, cityDisplay: null };
  if (ONE_WORD_CITIES.has(last) && words.length >= 2 && words[words.length - 2] !== "in") {
    const rawWords = raw.trim().split(/\s+/);
    const venue = rawWords.slice(0, -1).join(" ");
    return { cleanVenue: venue, cityDisplay: last[0]!.toUpperCase() + last.slice(1).toLowerCase() };
  }

  return { cleanVenue: raw, cityDisplay: null };
}

/** Returns a display city (e.g. "London") when the query ends with a known city token. */
export function extractTrailingCityFromPlaceQuery(placeQuery: string): string | null {
  return splitVenueAndTrailingCity(placeQuery).cityDisplay;
}

/** If place B has no explicit city hint, append inherited city from side A. */
export function augmentPlaceQueryWithInheritedCity(placeB: string, inheritedCity: string | null): string {
  const b = placeB.trim();
  if (!b || !inheritedCity) return b;
  const bl = b.toLowerCase();
  const il = inheritedCity.toLowerCase();
  if (bl.includes(il)) return b;
  return `${b} ${inheritedCity}`;
}
