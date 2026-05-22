import type { MapLandmarkPlace } from "@/lib/maps/mapLandmarkTypes";
import type { GoogleLocalizedText } from "@/lib/places/normalizeGoogleReviews";

const SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";

/** Minimal fields for map pins (Places API New). */
const NEARBY_FIELD_MASK = "places.id,places.displayName,places.location";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function localizedText(t: unknown): string {
  if (!isRecord(t)) return "";
  const text = t.text;
  return typeof text === "string" ? text.trim() : "";
}

function normalizeGooglePlaceId(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  if (s.startsWith("places/")) return s.replace(/^places\//, "");
  return s;
}

/**
 * Nearby Search (New) for map context only. Server-only (`GOOGLE_PLACES_API_KEY`).
 * Caps results; does not affect ranking.
 */
export async function fetchNearbyMapLandmarks(input: {
  center: { lat: number; lng: number };
  radiusMeters: number;
  maxResults: number;
  excludeGooglePlaceIds?: ReadonlySet<string>;
}): Promise<MapLandmarkPlace[]> {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"]?.trim();
  if (!apiKey) return [];

  const { center, radiusMeters, maxResults, excludeGooglePlaceIds } = input;
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng) || !Number.isFinite(radiusMeters)) return [];

  const radius = Math.min(3000, Math.max(200, radiusMeters));
  const cap = Math.min(8, Math.max(1, Math.floor(maxResults)));

  try {
    const res = await fetch(SEARCH_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": NEARBY_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: ["tourist_attraction", "museum"],
        maxResultCount: cap,
        locationRestriction: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius,
          },
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[VibeGap] map landmarks searchNearby failed: HTTP ${res.status}`);
      return [];
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return [];
    }

    if (!isRecord(json)) return [];
    if ("error" in json && json.error != null) {
      console.warn("[VibeGap] map landmarks searchNearby returned error object.");
      return [];
    }

    const places = json.places;
    if (!Array.isArray(places)) return [];

    const out: MapLandmarkPlace[] = [];
    for (const p of places) {
      if (!isRecord(p)) continue;
      const googlePlaceId = normalizeGooglePlaceId(p.id ?? p.name);
      if (!googlePlaceId) continue;
      const name = localizedText(p.displayName as GoogleLocalizedText | undefined);
      if (!name) continue;
      const loc = p.location;
      if (!isRecord(loc)) continue;
      const lat = loc.latitude;
      const lng = loc.longitude;
      if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }
      if (excludeGooglePlaceIds?.has(googlePlaceId)) continue;
      out.push({ googlePlaceId, name, lat, lng });
    }

    return dedupeLandmarks(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[VibeGap] map landmarks searchNearby error: ${message}`);
    return [];
  }
}

function dedupeLandmarks(items: MapLandmarkPlace[]): MapLandmarkPlace[] {
  const seen = new Set<string>();
  const deduped: MapLandmarkPlace[] = [];
  for (const x of items) {
    const key = `${x.googlePlaceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(x);
  }
  return deduped;
}
