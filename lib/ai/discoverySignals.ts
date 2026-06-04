import type { PlaceData } from "@/lib/types/vibecheck";

export type FreshnessLabel = "Established" | "Balanced" | "Fresh pick" | "Emerging";

export type DiscoverySignals = {
  discoveryScore: number;
  freshnessLabel: FreshnessLabel;
  reasons: string[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Honest, review-volume–aware “discovery” proxy (no social feeds).
 */
export function computeDiscoverySignals(place: PlaceData): DiscoverySignals {
  const rc = place.reviewCount;
  const rating = place.averageRating;
  const reasons: string[] = [];
  let score = 50;

  if (rc >= 3500) {
    reasons.push("Very high review volume — well-established footprint");
    score -= 18;
  } else if (rc >= 1200) {
    reasons.push("Strong review coverage");
    score -= 8;
  } else if (rc <= 200 && rating >= 4.2) {
    reasons.push("Fewer reviews but ratings look promising");
    score += 22;
  } else if (rc <= 480 && rating >= 4.3) {
    reasons.push("Moderate review volume with solid ratings");
    score += 12;
  }

  const blob = [...place.complaints, ...place.positives, place.recentReviewSummary].join(" ").toLowerCase();
  const hasDiscoveryLanguage =
    /\b(hidden gem|local favorite|locals?|neighborhood|neighbourhood|less touristy|quiet corner)\b/i.test(blob);
  if (hasDiscoveryLanguage) {
    reasons.push("Review language suggests a less obvious pick");
    score += 10;
  }
  if (/\b(new|recently opened|soft opening)\b/i.test(blob)) {
    reasons.push("Review or listing language mentions a newer opening window");
    score += 4;
  }
  if (/\b(popular|recommended|busy spot)\b/i.test(blob)) {
    reasons.push("Review language signals steady demand (not a social trend claim)");
    score += 3;
  }

  score = clamp(Math.round(score), 0, 100);

  let freshnessLabel: FreshnessLabel;
  if (rc >= 2500 && rating >= 4.3) freshnessLabel = "Established";
  else if (rc <= 240 && rating >= 4.2 && hasDiscoveryLanguage) freshnessLabel = "Fresh pick";
  else if (rc <= 900) freshnessLabel = "Emerging";
  else freshnessLabel = "Balanced";

  return { discoveryScore: score, freshnessLabel, reasons };
}
