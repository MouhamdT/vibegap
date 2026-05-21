import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { getDistanceMeters } from "@/lib/geo/distance";
import type { LatLng } from "@/lib/geo/distance";
import type { QueryClassification } from "@/lib/ai/queryMode";
import { resolveTextSearchFirstLatLng } from "@/lib/places/resolveTextSearchLatLng";
import type { PlaceData, SinglePlaceGeography } from "@/lib/types/vibecheck";

function hasLatLng(p: PlaceData): p is PlaceData & { latitude: number; longitude: number } {
  return typeof p.latitude === "number" && Number.isFinite(p.latitude) && typeof p.longitude === "number" && Number.isFinite(p.longitude);
}

/** Trailing "near …" / "close to …" anchor for single-place queries (e.g. Nobu London near Hyde Park). */
function extractNearAnchorFromQuery(raw: string): string | null {
  const t = raw.trim();
  const close = t.match(/\bclose\s+to\s+(.+)$/i);
  if (close?.[1]?.trim()) return formatSearchQueryForDisplay(close[1].trim());
  const near = t.match(/\bnear\s+(.+)$/i);
  if (near?.[1]?.trim()) return formatSearchQueryForDisplay(near[1].trim());
  return null;
}

export async function buildSinglePlaceGeography(
  searchQuery: string,
  classification: QueryClassification,
  place: PlaceData,
): Promise<SinglePlaceGeography | null> {
  if (place.dataSource !== "google") return null;

  const nearAnchorDisplayName = extractNearAnchorFromQuery(searchQuery);
  const searchAreaLabel =
    classification.locationCandidate?.trim().length
      ? formatSearchQueryForDisplay(classification.locationCandidate.trim())
      : null;

  let anchorLat: number | null = null;
  let anchorLng: number | null = null;

  if (nearAnchorDisplayName) {
    const q = searchAreaLabel ? `${nearAnchorDisplayName}, ${searchAreaLabel}` : nearAnchorDisplayName;
    const hit = await resolveTextSearchFirstLatLng(q);
    if (hit) {
      anchorLat = hit.latitude;
      anchorLng = hit.longitude;
    }
  }

  if (!hasLatLng(place)) {
    return {
      searchAreaLabel,
      nearAnchorDisplayName,
      placeLatitude: null,
      placeLongitude: null,
      anchorLatitude: anchorLat,
      anchorLongitude: anchorLng,
      distanceFromAnchorMeters: null,
      mapPreviewNote: null,
    };
  }

  const placePoint: LatLng = { latitude: place.latitude, longitude: place.longitude };
  const anchor: LatLng | null =
    anchorLat != null && anchorLng != null ? { latitude: anchorLat, longitude: anchorLng } : null;

  const distanceFromAnchorMeters =
    anchor != null && nearAnchorDisplayName != null ? getDistanceMeters(anchor, placePoint) : null;

  const mapPreviewNote =
    nearAnchorDisplayName == null ? "Location available for map view later." : null;

  return {
    searchAreaLabel,
    nearAnchorDisplayName,
    placeLatitude: place.latitude,
    placeLongitude: place.longitude,
    anchorLatitude: anchorLat,
    anchorLongitude: anchorLng,
    distanceFromAnchorMeters,
    mapPreviewNote,
  };
}
