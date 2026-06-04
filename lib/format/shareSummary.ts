import type { CompareResult, RankedCandidate, VibeReport } from "@/lib/types/vibecheck";

export function buildSinglePlaceShareSummary(report: VibeReport): string {
  const goal = report.placeIntentGoalDisplay?.trim();
  const goalBit = goal ? ` · Goal: ${goal}` : "";
  return `VibeGap — ${report.place.name}${goalBit}. Decision: ${report.decision.label}. ${report.quickVerdict.title}`;
}

export function buildRecommendationsShareSummary(
  intentLabel: string,
  locationCandidate: string,
  top: RankedCandidate | undefined,
  nearAnchorName?: string | null,
): string {
  const loc = nearAnchorName?.trim() ? `near ${nearAnchorName}` : `in ${locationCandidate}`;
  if (!top) return `VibeGap — ${intentLabel} ${loc}. (No ranked pick in this run.)`;
  return `VibeGap — ${intentLabel} ${loc}. Top pick: ${top.place.name} (${top.decision.label}, fit ${top.fitScore}).`;
}

export function buildCompareShareSummary(compare: CompareResult): string {
  const winner =
    compare.winnerPlaceId === compare.sideA.place.id ? compare.sideA.place.name : compare.sideB.place.name;
  return `VibeGap compare — ${compare.placeAName} vs ${compare.placeBName}. Lean: ${winner}. ${compare.compareHeadlineSubtitle}`;
}
