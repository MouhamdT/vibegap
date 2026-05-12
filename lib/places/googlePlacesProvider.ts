import type { PlaceData } from "@/lib/types/vibecheck";
import { normalizeGooglePlaceToPlaceData, type GooglePlaceApi } from "@/lib/places/normalizeGooglePlace";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

/** Field mask must be a single comma-separated list with no spaces (Places API New). */
const GOOGLE_PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryType,places.primaryTypeDisplayName,places.regularOpeningHours,places.reviews,places.photos";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstPlaceFromResponse(json: unknown): GooglePlaceApi | null {
  if (!isRecord(json)) return null;
  const places = json.places;
  if (!Array.isArray(places) || places.length === 0) return null;
  const first = places[0];
  if (!isRecord(first)) return null;
  return first as GooglePlaceApi;
}

/**
 * Text Search (New) for a single best match, normalized to `PlaceData`.
 * Server-only: uses `process.env.GOOGLE_PLACES_API_KEY`. Returns null if unset, empty, or on failure.
 */
export async function getGooglePlaceData(query: string): Promise<PlaceData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  const textQuery = query.trim();
  if (!textQuery) return null;

  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery }),
    });

    if (!res.ok) {
      console.warn(
        `[VibeGap] Google Places searchText failed: HTTP ${res.status} for query length ${textQuery.length}`,
      );
      return null;
    }

    const json: unknown = await res.json();
    const place = firstPlaceFromResponse(json);
    if (!place) return null;

    return normalizeGooglePlaceToPlaceData(place, query);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[VibeGap] Google Places searchText error: ${message}`);
    return null;
  }
}
