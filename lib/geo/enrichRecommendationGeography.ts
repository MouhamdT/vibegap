import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { getDistanceMeters } from "@/lib/geo/distance";
import type { LatLng } from "@/lib/geo/distance";
import { resolveTextSearchFirstLatLng } from "@/lib/places/resolveTextSearchLatLng";
import type { PlaceData, RankedCandidate, RecommendationGeography } from "@/lib/types/vibecheck";

function hasLatLng(p: PlaceData): p is PlaceData & { latitude: number; longitude: number } {
  return typeof p.latitude === "number" && Number.isFinite(p.latitude) && typeof p.longitude === "number" && Number.isFinite(p.longitude);
}

function anchorPointFromPlace(place: PlaceData | null | undefined): LatLng | null {
  if (!place || !hasLatLng(place)) return null;
  return { latitude: place.latitude, longitude: place.longitude };
}

/** Re-derive geography copy lines after client-side resort (e.g. Tune ranking). */
export function assignGeographySignalLines(
  candidates: RankedCandidate[],
  nearAnchorName: string | null,
): RankedCandidate[] {
  const numeric = candidates.map((c) => c.distanceFromAnchorMeters).filter((x): x is number => typeof x === "number");
  const minD = numeric.length > 0 ? Math.min(...numeric) : null;
  const landmarkLabel = nearAnchorName?.trim() ? formatSearchQueryForDisplay(nearAnchorName.trim()) : null;

  return candidates.map((c) => {
    const d = c.distanceFromAnchorMeters;
    if (d == null || minD == null) {
      return { ...c, geographySignalLine: null };
    }
    if (d <= minD + 75) {
      return {
        ...c,
        geographySignalLine: "Closer to the anchor than most options in this shortlist.",
      };
    }
    if (landmarkLabel && d > minD + 150) {
      return {
        ...c,
        geographySignalLine: `Good venue fit, but farther from ${landmarkLabel} than the closest pick.`,
      };
    }
    return { ...c, geographySignalLine: null };
  });
}

export async function enrichRecommendationGeography(args: {
  candidates: RankedCandidate[];
  locationCandidate: string;
  nearAnchorName: string | null;
  /** Resolved landmark place from landmark routing (coordinates when Places returns them). */
  landmarkAnchorPlace?: PlaceData | null;
}): Promise<{ candidates: RankedCandidate[]; geography: RecommendationGeography }> {
  const { candidates, locationCandidate, nearAnchorName, landmarkAnchorPlace } = args;
  const area = locationCandidate.trim();
  const near = nearAnchorName?.trim() || null;

  let anchorLat: number | null = null;
  let anchorLng: number | null = null;

  const fromLandmark = anchorPointFromPlace(landmarkAnchorPlace ?? null);
  if (fromLandmark) {
    anchorLat = fromLandmark.latitude;
    anchorLng = fromLandmark.longitude;
  } else if (near) {
    const hit = await resolveTextSearchFirstLatLng(`${near}, ${area}`);
    if (hit) {
      anchorLat = hit.latitude;
      anchorLng = hit.longitude;
    }
  } else if (area.length > 0) {
    const hit = await resolveTextSearchFirstLatLng(area);
    if (hit) {
      anchorLat = hit.latitude;
      anchorLng = hit.longitude;
    }
  }

  const anchor: LatLng | null =
    anchorLat != null && anchorLng != null ? { latitude: anchorLat, longitude: anchorLng } : null;

  const withDistance = candidates.map((c) => {
    if (!anchor || !hasLatLng(c.place)) {
      return { ...c, distanceFromAnchorMeters: null as number | null, geographySignalLine: null as string | null };
    }
    const d = getDistanceMeters(anchor, { latitude: c.place.latitude, longitude: c.place.longitude });
    return { ...c, distanceFromAnchorMeters: d, geographySignalLine: null as string | null };
  });

  const numeric = withDistance.map((c) => c.distanceFromAnchorMeters).filter((x): x is number => typeof x === "number");
  const anyDistance = numeric.length > 0;

  const withSignals = assignGeographySignalLines(withDistance, near);

  return {
    candidates: withSignals,
    geography: {
      searchAreaLabel: area,
      nearAnchorDisplayName: near,
      anchorLatitude: anchorLat,
      anchorLongitude: anchorLng,
      hasApproximateDistances: anyDistance,
    },
  };
}
