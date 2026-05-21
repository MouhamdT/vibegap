import type { PlaceData } from "@/lib/types/vibecheck";
import { normalizeGooglePlaceToPlaceData, type GooglePlaceApi } from "@/lib/places/normalizeGooglePlace";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";

/** Field mask must be a single comma-separated list with no spaces (Places API New). */
const GOOGLE_PLACE_SEARCH_FIELD_MASK =
  "places.id,places.name,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.primaryType,places.primaryTypeDisplayName";

const GOOGLE_PLACE_DETAILS_FIELD_MASK =
  "id,name,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,reviews,types,primaryType,primaryTypeDisplayName";

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

function extractPlaceResourceName(place: GooglePlaceApi): string | null {
  if (typeof place.name === "string" && /^places\/.+/.test(place.name)) return place.name;
  if (typeof place.id === "string" && place.id.trim()) return `places/${place.id.trim()}`;
  return null;
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
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"]?.trim();
  if (!apiKey) return { status: "unavailable" };

  const textQuery = query.trim();
  if (!textQuery) return { status: "unavailable" };

  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_PLACE_SEARCH_FIELD_MASK,
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

    const resourceName = extractPlaceResourceName(place);
    if (!resourceName) {
      console.warn("[VibeGap] Google Places searchText returned a place without a usable resource name.");
      return { status: "unavailable" };
    }

    const detailsRes = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(resourceName.replace(/^places\//, ""))}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_PLACE_DETAILS_FIELD_MASK,
      },
    });
    if (!detailsRes.ok) {
      console.warn(
        `[VibeGap] Google Place Details failed: HTTP ${detailsRes.status} for query length ${textQuery.length}`,
      );
      return { status: "unavailable" };
    }

    let detailsJson: unknown;
    try {
      detailsJson = await detailsRes.json();
    } catch {
      return { status: "unavailable" };
    }
    if (!isRecord(detailsJson)) return { status: "unavailable" };
    if ("error" in detailsJson && detailsJson.error != null) {
      console.warn("[VibeGap] Google Place Details returned an error object in the JSON body.");
      return { status: "unavailable" };
    }

    try {
      return { status: "ok", place: normalizeGooglePlaceToPlaceData(detailsJson as GooglePlaceApi, textQuery) };
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
