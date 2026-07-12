import { recommendationDistanceLabel } from "@/lib/geo/recommendationDistanceLabel";
import { formatFitScoreTen } from "@/lib/format/fitScoreTen";
import type { RankedCandidate, RecommendationGeography } from "@/lib/types/vibecheck";

/** Two-line footer for the recommendation decision map modal. */
export function formatRecommendationMapFooter(
  candidate: RankedCandidate,
  rank: number,
  geography: RecommendationGeography | null | undefined,
): string {
  const line1 = `#${rank} ${candidate.place.name} - ${candidate.place.address}`;
  const bits: string[] = [candidate.decision.label, formatFitScoreTen(candidate.fitScore)];
  const distLine = recommendationDistanceLabel(candidate.distanceFromAnchorMeters, geography);
  if (distLine) bits.push(distLine);
  return `${line1}\n${bits.join(" · ")}`;
}
