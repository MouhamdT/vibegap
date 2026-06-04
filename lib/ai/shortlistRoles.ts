import type { RecommendationStyleMode } from "@/lib/ai/recommendationStyleRank";
import { isBrunchLikeIntent } from "@/lib/ai/candidateQualityGate";
import { detectPlaceTypeCategory } from "@/lib/ai/placeTypeDetection";
import type { DetectedIntent, RankedCandidate, RecommendationGeography } from "@/lib/types/vibecheck";

/**
 * V30: assigns at most one curated role per row for scan-friendly shortlists.
 * Does not change underlying scores — display / explanation only.
 */
export function assignShortlistRoles(
  candidates: RankedCandidate[],
  intent: DetectedIntent,
  geography: RecommendationGeography | null | undefined,
  style: RecommendationStyleMode,
): RankedCandidate[] {
  if (candidates.length === 0) return candidates;
  const used = new Set<string>();
  const roles = new Map<string, string>();

  const mark = (id: string, role: string) => {
    if (used.has(id)) return false;
    used.add(id);
    roles.set(id, role);
    return true;
  };

  mark(candidates[0]!.place.id, "Best overall");

  const safest = [...candidates]
    .sort((a, b) => {
      const o: Record<string, number> = { High: 2, Medium: 1, Low: 0 };
      return (o[b.decision.confidence] ?? 0) - (o[a.decision.confidence] ?? 0);
    })
    .find((c) => !used.has(c.place.id) && c.decision.label !== "SKIP");
  if (safest) mark(safest.place.id, "Safest choice");

  const withDist = candidates.filter((c) => typeof c.distanceFromAnchorMeters === "number");
  if (withDist.length > 0 && geography?.nearAnchorDisplayName) {
    const closest = [...withDist]
      .sort((a, b) => (a.distanceFromAnchorMeters ?? 9e9) - (b.distanceFromAnchorMeters ?? 9e9))
      .find((c) => !used.has(c.place.id));
    if (closest) mark(closest.place.id, "Closest to anchor");
  }

  const budgety =
    intent.kind === "budget_eats" ||
    intent.kind === "budget_celebration" ||
    /\b(cheap|budget|value|affordable)\b/i.test(`${intent.label} ${intent.matchedSignals.join(" ")}`);
  if (budgety) {
    const val = [...candidates]
      .sort((a, b) => a.place.priceLevel - b.place.priceLevel)
      .find((c) => !used.has(c.place.id));
    if (val) mark(val.place.id, "Best value");
  }

  if (intent.kind === "low_wait") {
    const byLowWaitRow = [...candidates]
      .filter((c) => c.decision.label !== "SKIP")
      .map((c) => {
        const row = c.scoreBreakdown.find((r) => r.label === "Low-wait fit");
        return { c, lowWaitScore: row?.score ?? 0 };
      })
      .sort((a, b) => b.lowWaitScore - a.lowWaitScore || b.c.fitScore - a.c.fitScore);
    const topWait = byLowWaitRow[0]?.c;
    if (topWait) mark(topWait.place.id, "Best low-wait read");
  }

  if (isBrunchLikeIntent(intent)) {
    const brunchy = candidates.find(
      (c) => !used.has(c.place.id) && detectPlaceTypeCategory(c.place) === "cafe_brunch",
    );
    if (brunchy) mark(brunchy.place.id, "Brunch-forward");
  }

  if (style === "discovery" || style === "balanced") {
    const fresh = candidates.find(
      (c) =>
        !used.has(c.place.id) &&
        c.decision.label !== "SKIP" &&
        c.intentQualityTier !== "poor" &&
        c.recommendationStyleLabel?.toLowerCase().includes("fresh"),
    );
    if (fresh) mark(fresh.place.id, "Fresh pick");
  }

  return candidates.map((c) => ({
    ...c,
    shortlistRole: roles.get(c.place.id),
  }));
}
