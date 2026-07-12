import { formatDistance } from "@/lib/geo/distance";
import type { DecisionLabel, RankedCandidate } from "@/lib/types/vibecheck";

export type PlanTravelMode = "walking" | "car";

/** Comfortable straight-line range before proximity starts costing fit points. */
const WALKING_COMFORT_M = 1200;
const CAR_COMFORT_M = 5500;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Proximity adjustment for stop-2 candidates once stop 1 is locked.
 * Walking: small bonus inside ~1.2 km, growing penalty beyond.
 * Car: barely penalized up to ~5.5 km.
 */
export function proximityFitDelta(distanceMeters: number | null, mode: PlanTravelMode): number {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return 0;
  const comfort = mode === "walking" ? WALKING_COMFORT_M : CAR_COMFORT_M;
  if (distanceMeters <= comfort) {
    // Closer is slightly better: up to +6 at the anchor, tapering to 0 at the comfort edge.
    return Math.round(6 * (1 - distanceMeters / comfort));
  }
  const over = distanceMeters - comfort;
  const perMeterDivisor = mode === "walking" ? 100 : 600;
  return -clamp(Math.round(over / perMeterDivisor), 0, 25);
}

/** Applies the proximity delta to a fit score (0–100 internal scale). */
export function proximityAdjustedFit(
  fitScore: number,
  distanceMeters: number | null,
  mode: PlanTravelMode,
): number {
  return clamp(Math.round(fitScore + proximityFitDelta(distanceMeters, mode)), 0, 100);
}

export type PlanVerdict = {
  label: DecisionLabel;
  /** 0–100 internal scale (display via formatFitScoreTen). */
  score: number;
  /** Short tradeoff lines for the plan card. */
  tradeoffLines: string[];
};

function dominantRiskKey(candidate: RankedCandidate): "wait" | "noise" | "price" | null {
  const risk = candidate.mainRisk.toLowerCase();
  if (/\bwait|line|queue|reservation\b/.test(risk)) return "wait";
  if (/\bnoise|crowd|loud\b/.test(risk)) return "noise";
  if (/\bprice|value|bill|spend\b/.test(risk)) return "price";
  return null;
}

const RISK_LABELS: Record<"wait" | "noise" | "price", string> = {
  wait: "Both stops carry wait risk — build in buffer time.",
  noise: "Both stops may run loud or crowded at peaks.",
  price: "Both stops carry price risk — check menus first.",
};

/**
 * Plan-level GO / MAYBE / SKIP from two locked stops:
 * mean of stop fits, minus a distance penalty beyond the mode's comfort range,
 * minus a small penalty when both stops share the same dominant risk.
 */
export function buildPlanVerdict(
  stopA: RankedCandidate,
  stopB: RankedCandidate,
  distanceMeters: number | null,
  mode: PlanTravelMode,
): PlanVerdict {
  const tradeoffLines: string[] = [];
  let score = Math.round((stopA.fitScore + stopB.fitScore) / 2);

  if (distanceMeters != null && Number.isFinite(distanceMeters)) {
    const comfort = mode === "walking" ? WALKING_COMFORT_M : CAR_COMFORT_M;
    if (distanceMeters > comfort) {
      const over = distanceMeters - comfort;
      const penalty = clamp(Math.round(over / (mode === "walking" ? 120 : 800)), 2, 22);
      score -= penalty;
      tradeoffLines.push(
        mode === "walking"
          ? `About ${formatDistance(distanceMeters)} between stops — a long walk.`
          : `About ${formatDistance(distanceMeters)} between stops.`,
      );
    } else {
      tradeoffLines.push(`About ${formatDistance(distanceMeters)} between stops.`);
    }
  }

  const riskA = dominantRiskKey(stopA);
  const riskB = dominantRiskKey(stopB);
  if (riskA !== null && riskA === riskB) {
    score -= 6;
    tradeoffLines.push(RISK_LABELS[riskA]);
  }

  const weaker = stopA.fitScore <= stopB.fitScore ? stopA : stopB;
  if (weaker.decision.label !== "GO") {
    tradeoffLines.push(`${weaker.place.name} is the weaker leg — ${weaker.mainRisk.toLowerCase()}.`);
  }

  score = clamp(score, 0, 100);
  const label: DecisionLabel = score >= 72 ? "GO" : score >= 46 ? "MAYBE" : "SKIP";
  return { label, score, tradeoffLines: tradeoffLines.slice(0, 3) };
}
