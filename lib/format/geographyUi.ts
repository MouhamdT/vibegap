import { recommendationDistanceLabel } from "@/lib/geo/recommendationDistanceLabel";
import { formatDistance } from "@/lib/geo/distance";
import type { RankedCandidate, RecommendationGeography, SinglePlaceGeography } from "@/lib/types/vibecheck";

/** Compact segment for shortlist meta row (labeled distance only). */
export function shortlistGeographySegment(
  candidate: RankedCandidate,
  geography: RecommendationGeography | null | undefined,
): string | null {
  if (typeof candidate.distanceFromAnchorMeters !== "number" || !geography) return null;
  const line = recommendationDistanceLabel(candidate.distanceFromAnchorMeters, geography);
  if (!line) return null;
  return line.length > 56 ? `${line.slice(0, 53)}…` : line;
}

/** Selected-panel / header geography line. */
export function selectedVenueGeographyLine(
  candidate: RankedCandidate,
  geography: RecommendationGeography | null | undefined,
): string | null {
  if (typeof candidate.distanceFromAnchorMeters === "number" && geography) {
    const line = recommendationDistanceLabel(candidate.distanceFromAnchorMeters, geography);
    if (line) return line;
  }
  if (geography?.nearAnchorDisplayName?.trim() && candidate.distanceFromAnchorMeters == null) {
    return `Searching near ${geography.nearAnchorDisplayName.trim()}`;
  }
  if (geography?.searchAreaLabel?.trim()) {
    return `Located in ${geography.searchAreaLabel.trim()} search area`;
  }
  return null;
}

export function singlePlaceGeographyLines(geo: SinglePlaceGeography): { primary: string | null; secondary: string | null } {
  if (typeof geo.distanceFromAnchorMeters === "number") {
    if (geo.nearAnchorDisplayName?.trim()) {
      return {
        primary: `${formatDistance(geo.distanceFromAnchorMeters)} from ${geo.nearAnchorDisplayName.trim()}`,
        secondary: "Distances are approximate.",
      };
    }
    if (geo.searchAreaLabel?.trim()) {
      return {
        primary: `Approx. ${formatDistance(geo.distanceFromAnchorMeters)} from search center (${geo.searchAreaLabel.trim()})`,
        secondary: "Distances are approximate.",
      };
    }
  }
  if (geo.nearAnchorDisplayName?.trim() && geo.distanceFromAnchorMeters == null) {
    return { primary: `Searching near ${geo.nearAnchorDisplayName.trim()}`, secondary: null };
  }
  if (geo.mapPreviewNote) {
    return { primary: geo.mapPreviewNote, secondary: null };
  }
  if (geo.searchAreaLabel?.trim()) {
    return { primary: `Located in ${geo.searchAreaLabel.trim()} search area`, secondary: null };
  }
  return { primary: null, secondary: null };
}
