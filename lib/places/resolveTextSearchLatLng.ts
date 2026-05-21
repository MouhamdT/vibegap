import type { LatLng } from "@/lib/geo/distance";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLocation(raw: unknown): LatLng | null {
  if (!isRecord(raw)) return null;
  const loc = raw.location;
  if (!isRecord(loc)) return null;
  const lat = loc.latitude;
  const lng = loc.longitude;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

/**
 * Returns the first Text Search hit's coordinates (server-only, Google Places API New).
 */
export async function resolveTextSearchFirstLatLng(textQuery: string): Promise<LatLng | null> {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"]?.trim();
  if (!apiKey) return null;

  const q = textQuery.trim();
  if (!q.length) return null;

  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location",
      },
      body: JSON.stringify({ textQuery: q, pageSize: 1 }),
    });
    if (!res.ok) return null;

    const json: unknown = await res.json().catch(() => null);
    if (!isRecord(json)) return null;
    const places = json.places;
    if (!Array.isArray(places) || places.length === 0) return null;
    const first = places[0];
    return readLocation(first);
  } catch {
    return null;
  }
}
