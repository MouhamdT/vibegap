import { formatDistance } from "@/lib/geo/distance";
import type { RecommendationGeography } from "@/lib/types/vibecheck";

/**
 * Human-readable distance for recommendation UI (map, shortlist, panels).
 * Never returns a bare number — needs a named anchor or search-area context.
 */
export function recommendationDistanceLabel(
  meters: number | null | undefined,
  geography: RecommendationGeography | null | undefined,
): string | null {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0 || !geography) return null;
  const dist = formatDistance(meters);
  const namedAnchor = geography.nearAnchorDisplayName?.trim();
  if (namedAnchor) {
    return `${dist} from ${namedAnchor}`;
  }
  const area = geography.searchAreaLabel?.trim();
  if (area) {
    return `Approx. ${dist} from search center (${area})`;
  }
  return null;
}
