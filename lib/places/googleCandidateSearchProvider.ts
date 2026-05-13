import type { PlaceData } from "@/lib/types/vibecheck";
import { normalizeGooglePlaceToPlaceData, type GooglePlaceApi } from "@/lib/places/normalizeGooglePlace";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

const CANDIDATE_SEARCH_FIELD_MASK =
  "places.id,places.name,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryType,places.primaryTypeDisplayName";
const CANDIDATE_DETAILS_FIELD_MASK =
  "id,name,displayName,formattedAddress,rating,userRatingCount,priceLevel,reviews,types,primaryType,primaryTypeDisplayName";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractResourceName(place: GooglePlaceApi): string | null {
  if (typeof place.name === "string" && /^places\/.+/.test(place.name)) return place.name;
  if (typeof place.id === "string" && place.id.trim()) return `places/${place.id.trim()}`;
  return null;
}

export async function getGoogleCandidatePlaces(query: string, locationCandidate: string): Promise<PlaceData[]> {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"]?.trim();
  if (!apiKey) return [];

  const intentQuery = query.trim();
  const location = locationCandidate.trim();
  if (!intentQuery || !location) return [];

  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": CANDIDATE_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${intentQuery} in ${location}`,
        pageSize: 6,
      }),
    });
    if (!res.ok) return [];

    const json: unknown = await res.json().catch(() => null);
    if (!isRecord(json)) return [];
    const places = json.places;
    if (!Array.isArray(places) || places.length === 0) return [];

    const candidates: PlaceData[] = [];
    for (const raw of places.slice(0, 6)) {
      if (!isRecord(raw)) continue;
      const resource = extractResourceName(raw as GooglePlaceApi);
      if (!resource) continue;

      const detailsRes = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(resource.replace(/^places\//, ""))}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": CANDIDATE_DETAILS_FIELD_MASK,
        },
      });
      if (!detailsRes.ok) continue;

      const details: unknown = await detailsRes.json().catch(() => null);
      if (!isRecord(details)) continue;
      try {
        const place = normalizeGooglePlaceToPlaceData(details as GooglePlaceApi, `${intentQuery} in ${location}`);
        candidates.push(place);
      } catch {
        // skip malformed candidate
      }
    }

    return candidates.slice(0, 6);
  } catch {
    return [];
  }
}
