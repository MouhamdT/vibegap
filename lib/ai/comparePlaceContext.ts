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
  "nice",
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

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Returns a display city (e.g. "London") when the query ends with a known city token. */
export function extractTrailingCityFromPlaceQuery(placeQuery: string): string | null {
  const t = placeQuery.trim().toLowerCase();
  if (!t) return null;

  for (const pair of TWO_WORD_CITIES) {
    if (t.endsWith(pair)) {
      const before = t.slice(0, t.length - pair.length).trim();
      if (before.length < 2) continue;
      return titleCaseWords(pair);
    }
  }

  const words = t.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  if (!last) return null;
  if (ONE_WORD_CITIES.has(last) && words.length >= 2) {
    return last[0]!.toUpperCase() + last.slice(1).toLowerCase();
  }
  return null;
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
