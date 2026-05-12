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

export type GooglePlaceLookupResult =
  | { status: "ok"; place: PlaceData }
  | { status: "no_results" }
  | { status: "unavailable" };

/**
 * Text Search (New) for a single best match, normalized to `PlaceData`.
 * Server-only: uses `process.env.GOOGLE_PLACES_API_KEY`.
 * - `no_results`: HTTP 200 with no usable place (empty list or unusable first hit).
 * - `unavailable`: missing key, network/parse failure, HTTP error, API `error` object, or normalize failure.
 */
export async function fetchGooglePlaceForReport(query: string): Promise<GooglePlaceLookupResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return { status: "unavailable" };

  const textQuery = query.trim();
  if (!textQuery) return { status: "unavailable" };

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
      return { status: "unavailable" };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { status: "unavailable" };
    }

    if (!isRecord(json)) return { status: "unavailable" };
    if ("error" in json && json.error != null) {
      console.warn("[VibeGap] Google Places searchText returned an error object in the JSON body.");
      return { status: "unavailable" };
    }

    const place = firstPlaceFromResponse(json);
    if (!place) return { status: "no_results" };

    try {
      return { status: "ok", place: normalizeGooglePlaceToPlaceData(place, textQuery) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[VibeGap] Google Places normalize error: ${message}`);
      return { status: "unavailable" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[VibeGap] Google Places searchText error: ${message}`);
    return { status: "unavailable" };
  }
}
