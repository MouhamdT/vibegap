import { formatDistance } from "@/lib/geo/distance";
import type { RankedCandidate, RecommendationGeography, SinglePlaceGeography } from "@/lib/types/vibecheck";

function truncateLabel(label: string, max = 26): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Compact segment for shortlist meta row (e.g. "280m from Trevi Fountain"). */
export function shortlistGeographySegment(
  candidate: RankedCandidate,
  geography: RecommendationGeography | null | undefined,
): string | null {
  if (typeof candidate.distanceFromAnchorMeters !== "number" || !geography) return null;
  const label = truncateLabel(geography.nearAnchorDisplayName ?? geography.searchAreaLabel);
  if (!label) return null;
  return `${formatDistance(candidate.distanceFromAnchorMeters)} from ${label}`;
}

/** Selected-panel / header geography line. */
export function selectedVenueGeographyLine(
  candidate: RankedCandidate,
  geography: RecommendationGeography | null | undefined,
): string | null {
  if (typeof candidate.distanceFromAnchorMeters === "number" && geography) {
    const label = geography.nearAnchorDisplayName ?? geography.searchAreaLabel;
    if (label.trim()) return `${formatDistance(candidate.distanceFromAnchorMeters)} from ${label.trim()}`;
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
  if (typeof geo.distanceFromAnchorMeters === "number" && geo.nearAnchorDisplayName?.trim()) {
    return {
      primary: `${formatDistance(geo.distanceFromAnchorMeters)} from ${geo.nearAnchorDisplayName.trim()}`,
      secondary: "Distances are approximate.",
    };
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
