import { computeDiscoverySignals, type FreshnessLabel } from "@/lib/ai/discoverySignals";
import type { DecisionLabel, RankedCandidate } from "@/lib/types/vibecheck";

export type RecommendationStyleMode = "reliable" | "balanced" | "discovery";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function labelFromFit(fitScore: number): DecisionLabel {
  if (fitScore >= 72) return "GO";
  if (fitScore >= 46) return "MAYBE";
  return "SKIP";
}

function uiLabelFromFreshness(f: FreshnessLabel, style: RecommendationStyleMode): string | null {
  if (style === "reliable" && f === "Established") return "Established choice";
  if (style === "discovery" && (f === "Fresh pick" || f === "Emerging")) return "Fresh pick";
  if (style === "balanced" && f === "Balanced") return "Balanced pick";
  if (style === "discovery" && f === "Fresh pick") return "Discovery pick";
  return null;
}

/** Local re-rank only — no API calls. Runs after quality-gated scores exist on candidates. */
export function applyRecommendationStyleRescore(
  candidates: RankedCandidate[],
  style: RecommendationStyleMode,
): RankedCandidate[] {
  const rescored = candidates.map((c) => {
    const d = computeDiscoverySignals(c.place);
    const tier = c.intentQualityTier;
    let adj = c.fitScore;
    if (style === "reliable") {
      adj += clamp(Math.round(c.place.reviewCount / 350), 0, 14);
      adj += c.place.averageRating >= 4.4 ? 4 : 0;
      adj -= Math.round((d.discoveryScore - 50) * 0.06);
      if (tier === "poor") adj -= 8;
    } else if (style === "discovery") {
      const weakGate = tier === "poor" || tier === "weak";
      const discoveryWeight = weakGate ? 0.07 : 0.14;
      adj += Math.round((d.discoveryScore - 48) * discoveryWeight);
      adj -= clamp(Math.round(c.place.reviewCount / 500), 0, 8);
      if (tier === "poor") adj -= 12;
    } else {
      adj += Math.round((d.discoveryScore - 50) * 0.05);
    }
    const fitScore = clamp(Math.round(adj), 0, 100);
    const label = labelFromFit(fitScore);
    const ui = uiLabelFromFreshness(d.freshnessLabel, style);
    return {
      ...c,
      fitScore,
      decision: { ...c.decision, label },
      recommendationStyleLabel: ui,
    };
  });
  return [...rescored].sort((a, b) => b.fitScore - a.fitScore);
}
