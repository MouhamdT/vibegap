import type { PlaceData } from "@/lib/types/vibecheck";
import { normalizeGooglePlaceToPlaceData, type GooglePlaceApi } from "@/lib/places/normalizeGooglePlace";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

const CANDIDATE_SEARCH_FIELD_MASK =
  "places.id,places.name,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryType,places.primaryTypeDisplayName";
const CANDIDATE_DETAILS_FIELD_MASK =
  "id,name,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,reviews,types,primaryType,primaryTypeDisplayName";

const DETAILS_CONCURRENCY = 5;

/** In-memory TTL cache for candidate searches (per server instance, no DB). */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const candidateCache = new Map<string, { at: number; data: PlaceData[] }>();

function readCache(key: string): PlaceData[] | null {
  const hit = candidateCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    candidateCache.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache(key: string, data: PlaceData[]): void {
  if (candidateCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = candidateCache.keys().next().value;
    if (oldest !== undefined) candidateCache.delete(oldest);
  }
  candidateCache.set(key, { at: Date.now(), data });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractResourceName(place: GooglePlaceApi): string | null {
  if (typeof place.name === "string" && /^places\/.+/.test(place.name)) return place.name;
  if (typeof place.id === "string" && place.id.trim()) return `places/${place.id.trim()}`;
  return null;
}

/**
 * Builds the Places text query once. When the goal query already names the
 * location ("brunch in Prague"), we don't append it again — this previously
 * produced doubled queries like "brunch in Prague in Prague".
 */
export function buildCandidateTextQuery(query: string, locationCandidate: string): string {
  const goal = query.trim().replace(/\s+/g, " ");
  const location = locationCandidate.trim();
  if (!goal) return "";
  if (!location) return goal;

  const goalLower = goal.toLowerCase();
  const locationLower = location.toLowerCase();
  if (goalLower.includes(locationLower)) return goal;

  // Also treat the city part of "City, Country" as already present.
  const cityPart = locationLower.split(",")[0]?.trim();
  if (cityPart && new RegExp(`\\b${cityPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(goal)) {
    return goal;
  }

  return `${goal} in ${location}`;
}

async function fetchCandidateDetails(
  resource: string,
  apiKey: string,
  textQuery: string,
): Promise<PlaceData | null> {
  try {
    const detailsRes = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(resource.replace(/^places\//, ""))}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": CANDIDATE_DETAILS_FIELD_MASK,
      },
    });
    if (!detailsRes.ok) return null;

    const details: unknown = await detailsRes.json().catch(() => null);
    if (!isRecord(details)) return null;
    return normalizeGooglePlaceToPlaceData(details as GooglePlaceApi, textQuery);
  } catch {
    return null;
  }
}

/** Maps over items with a small concurrency cap, preserving input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function getGoogleCandidatePlaces(query: string, locationCandidate: string): Promise<PlaceData[]> {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"]?.trim();
  if (!apiKey) return [];

  const textQuery = buildCandidateTextQuery(query, locationCandidate);
  if (!textQuery || !locationCandidate.trim()) return [];

  const cacheKey = textQuery.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": CANDIDATE_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 20,
      }),
    });
    if (!res.ok) return [];

    const json: unknown = await res.json().catch(() => null);
    if (!isRecord(json)) return [];
    const places = json.places;
    if (!Array.isArray(places) || places.length === 0) return [];

    const resources: string[] = [];
    for (const raw of places.slice(0, 20)) {
      if (!isRecord(raw)) continue;
      const resource = extractResourceName(raw as GooglePlaceApi);
      if (resource) resources.push(resource);
    }

    const detailed = await mapWithConcurrency(resources, DETAILS_CONCURRENCY, (resource) =>
      fetchCandidateDetails(resource, apiKey, textQuery),
    );

    const candidates = detailed.filter((p): p is PlaceData => p !== null).slice(0, 20);
    if (candidates.length > 0) writeCache(cacheKey, candidates);
    return candidates;
  } catch {
    return [];
  }
}
