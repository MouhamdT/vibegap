import type {
  CompareFactorRow,
  ComparePlaceSide,
  CompareResult,
  DecisionConfidence,
  DecisionLabel,
  DetectedIntent,
  PlaceData,
  RankedCandidate,
} from "@/lib/types/vibecheck";

export const PRIORITY_KEYS = [
  "quietCrowd",
  "lowWait",
  "budgetValue",
  "atmosphere",
  "reviewConfidence",
] as const;

export type PriorityKey = (typeof PRIORITY_KEYS)[number];

export type PriorityWeights = Record<PriorityKey, number>;

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  quietCrowd: "Quiet / low crowd",
  lowWait: "Low wait",
  budgetValue: "Budget / value",
  atmosphere: "Atmosphere / occasion",
  reviewConfidence: "Review confidence",
};

export type PriorityDimensions = Record<PriorityKey, number>;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safeScore(n: number | null | undefined, fallback = 50): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 0, 100);
}

function scoreFromBreakdown(
  rows: RankedCandidate["scoreBreakdown"],
  patterns: RegExp[],
): number | null {
  for (const row of rows) {
    if (patterns.some((p) => p.test(row.label))) {
      return safeScore(row.score);
    }
  }
  return null;
}

function confidenceToScore(confidence: DecisionConfidence): number {
  if (confidence === "High") return 85;
  if (confidence === "Medium") return 65;
  return 40;
}

function priceToValueScore(priceLevel: number): number {
  return clamp(92 - priceLevel * 18, 20, 95);
}

export function extractPriorityDimensions(
  scoreBreakdown: RankedCandidate["scoreBreakdown"],
  place: PlaceData,
  reviewConfidence: DecisionConfidence,
): PriorityDimensions {
  const quietFit = scoreFromBreakdown(scoreBreakdown, [/quiet|study fit/i]);
  const noiseDrag = scoreFromBreakdown(scoreBreakdown, [/noise|crowding drag/i]);
  const quietCrowd =
    quietFit !== null && noiseDrag !== null
      ? safeScore(Math.round((quietFit + noiseDrag) / 2))
      : quietFit ?? noiseDrag ?? safeScore(72 - place.priceLevel * 6);

  const lowWait =
    scoreFromBreakdown(scoreBreakdown, [/low-wait|wait\/reservation|queue|reservation pressure/i]) ??
    scoreFromBreakdown(scoreBreakdown, [/wait/i]) ??
    55;

  const budgetValue =
    scoreFromBreakdown(scoreBreakdown, [/budget|value fit|price \/ access/i]) ?? priceToValueScore(place.priceLevel);

  const atmosphere =
    scoreFromBreakdown(scoreBreakdown, [/occasion|ambience|nightlife|energy/i]) ??
    clamp(Math.round(place.averageRating * 16 + (place.priceLevel >= 3 ? 12 : 0)), 25, 90);

  const reviewStrength = scoreFromBreakdown(scoreBreakdown, [/review strength/i]);
  const signalConfidence = scoreFromBreakdown(scoreBreakdown, [/signal confidence|confidence/i]);
  const reviewConfidenceScore =
    signalConfidence ?? reviewStrength ?? confidenceToScore(reviewConfidence);

  return {
    quietCrowd,
    lowWait,
    budgetValue,
    atmosphere,
    reviewConfidence: reviewConfidenceScore,
  };
}

export function getDefaultPriorityWeights(intent: DetectedIntent): PriorityWeights {
  const veganGoal = intent.matchedSignals.some((s) => /\bvegan|vegetarian|plant[- ]based\b/i.test(s));
  if (veganGoal) {
    return {
      quietCrowd: 40,
      lowWait: 55,
      budgetValue: 70,
      atmosphere: 45,
      reviewConfidence: 68,
    };
  }

  switch (intent.kind) {
    case "study_work":
    case "quiet_calm":
      return {
        quietCrowd: 85,
        lowWait: 55,
        budgetValue: 50,
        atmosphere: 25,
        reviewConfidence: 65,
      };
    case "budget_eats":
    case "budget_celebration":
      return {
        quietCrowd: 28,
        lowWait: 55,
        budgetValue: 88,
        atmosphere: 50,
        reviewConfidence: 60,
      };
    case "luxury":
    case "date_night":
      return {
        quietCrowd: 22,
        lowWait: 55,
        budgetValue: 35,
        atmosphere: 88,
        reviewConfidence: 75,
      };
    case "low_wait":
      return {
        quietCrowd: 55,
        lowWait: 90,
        budgetValue: 50,
        atmosphere: 28,
        reviewConfidence: 72,
      };
    case "party_nightlife":
      return {
        quietCrowd: 18,
        lowWait: 45,
        budgetValue: 38,
        atmosphere: 85,
        reviewConfidence: 60,
      };
    case "family":
      return {
        quietCrowd: 48,
        lowWait: 62,
        budgetValue: 52,
        atmosphere: 42,
        reviewConfidence: 65,
      };
    default:
      return {
        quietCrowd: 50,
        lowWait: 50,
        budgetValue: 50,
        atmosphere: 50,
        reviewConfidence: 60,
      };
  }
}

export function computeWeightedFitScore(dimensions: PriorityDimensions, weights: PriorityWeights): number {
  let totalW = 0;
  let sum = 0;
  for (const key of PRIORITY_KEYS) {
    const w = weights[key];
    if (w <= 0) continue;
    totalW += w;
    sum += dimensions[key] * w;
  }
  if (totalW <= 0) return 50;
  return clamp(Math.round(sum / totalW), 0, 100);
}

function labelFromFit(fitScore: number): DecisionLabel {
  if (fitScore >= 72) return "GO";
  if (fitScore >= 46) return "MAYBE";
  return "SKIP";
}

export function weightsEqual(a: PriorityWeights, b: PriorityWeights): boolean {
  return PRIORITY_KEYS.every((k) => a[k] === b[k]);
}

export function describePriorityChange(previous: PriorityWeights, next: PriorityWeights): string {
  const deltas = PRIORITY_KEYS.map((key) => ({
    key,
    delta: next[key] - previous[key],
    label: PRIORITY_LABELS[key],
  }))
    .filter((d) => Math.abs(d.delta) >= 6)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (deltas.length === 0) {
    return "Ranking updated based on your priority mix using available review signals.";
  }

  const top = deltas[0]!;
  const increased = top.delta > 0;
  const effect = influenceEffect(top.key, increased);
  return `Ranking updated: ${top.label.toLowerCase()} now has more influence, so ${effect}.`;
}

function influenceEffect(key: PriorityKey, increased: boolean): string {
  if (key === "quietCrowd") {
    return increased ? "quieter venues moved up" : "livelier or busier venues moved up";
  }
  if (key === "lowWait") {
    return increased ? "lower-wait picks moved up" : "venues with more wait friction moved up";
  }
  if (key === "budgetValue") {
    return increased ? "better value / lower-price venues moved up" : "premium or pricier venues moved up";
  }
  if (key === "atmosphere") {
    return increased ? "occasion-forward venues moved up" : "casual or simpler picks moved up";
  }
  return increased
    ? "venues with stronger review coverage moved up"
    : "venues with thinner review signals moved up";
}

export function applyPriorityWeightsToCandidates(
  candidates: RankedCandidate[],
  weights: PriorityWeights,
): RankedCandidate[] {
  const rescored = candidates.map((candidate) => {
    const dimensions = extractPriorityDimensions(
      candidate.scoreBreakdown,
      candidate.place,
      candidate.decision.confidence,
    );
    const fitScore = computeWeightedFitScore(dimensions, weights);
    return {
      ...candidate,
      fitScore,
      decision: {
        ...candidate.decision,
        label: labelFromFit(fitScore),
      },
    };
  });

  return [...rescored].sort((a, b) => b.fitScore - a.fitScore);
}

function confidenceRank(c: DecisionConfidence): number {
  if (c === "High") return 3;
  if (c === "Medium") return 2;
  return 1;
}

function decisionRank(label: DecisionLabel): number {
  if (label === "GO") return 3;
  if (label === "MAYBE") return 2;
  return 1;
}

function riskRank(label: string): number {
  if (label === "Low") return 0;
  if (label === "High") return 2;
  return 1;
}

function pickCompareWinner(a: ComparePlaceSide, b: ComparePlaceSide): "a" | "b" {
  if (a.fitScore !== b.fitScore) {
    return a.fitScore > b.fitScore ? "a" : "b";
  }
  const dr = decisionRank(a.decision.label) - decisionRank(b.decision.label);
  if (dr !== 0) return dr > 0 ? "a" : "b";
  if (a.vibeGapScore !== null && b.vibeGapScore !== null && a.vibeGapScore !== b.vibeGapScore) {
    return a.vibeGapScore < b.vibeGapScore ? "a" : "b";
  }
  if (a.waitRiskLabel !== b.waitRiskLabel) {
    return riskRank(a.waitRiskLabel) < riskRank(b.waitRiskLabel) ? "a" : "b";
  }
  return "a";
}

function compareNumeric(a: number, b: number, higherWins: boolean): boolean | null {
  if (Math.abs(a - b) < 4) return null;
  return higherWins ? a > b : a < b;
}

function advantageName(betterIsA: boolean | null, placeAName: string, placeBName: string): string {
  if (betterIsA === null) return "Tie";
  return betterIsA ? placeAName : placeBName;
}

function buildFactorRows(
  a: ComparePlaceSide,
  b: ComparePlaceSide,
  placeAName: string,
  placeBName: string,
): CompareFactorRow[] {
  const vibeA = a.vibeGapScore !== null ? String(a.vibeGapScore) : "Not enough signal";
  const vibeB = b.vibeGapScore !== null ? String(b.vibeGapScore) : "Not enough signal";

  return [
    {
      factor: "Goal fit",
      placeAValue: String(a.fitScore),
      placeBValue: String(b.fitScore),
      advantage: advantageName(compareNumeric(a.fitScore, b.fitScore, true), placeAName, placeBName),
    },
    {
      factor: "Review confidence",
      placeAValue: a.reviewConfidence,
      placeBValue: b.reviewConfidence,
      advantage: advantageName(
        confidenceRank(a.reviewConfidence) === confidenceRank(b.reviewConfidence)
          ? null
          : confidenceRank(a.reviewConfidence) > confidenceRank(b.reviewConfidence),
        placeAName,
        placeBName,
      ),
    },
    {
      factor: "Wait risk",
      placeAValue: a.waitRiskLabel,
      placeBValue: b.waitRiskLabel,
      advantage: advantageName(
        a.waitRiskLabel === b.waitRiskLabel ? null : riskRank(a.waitRiskLabel) < riskRank(b.waitRiskLabel),
        placeAName,
        placeBName,
      ),
    },
    {
      factor: "Noise / crowding risk",
      placeAValue: a.noiseCrowdingLabel,
      placeBValue: b.noiseCrowdingLabel,
      advantage: advantageName(
        a.noiseCrowdingLabel === b.noiseCrowdingLabel
          ? null
          : riskRank(a.noiseCrowdingLabel) < riskRank(b.noiseCrowdingLabel),
        placeAName,
        placeBName,
      ),
    },
    {
      factor: "Price / value risk",
      placeAValue: a.priceValueLabel,
      placeBValue: b.priceValueLabel,
      advantage: advantageName(
        a.priceValueLabel === b.priceValueLabel
          ? null
          : riskRank(a.priceValueLabel) < riskRank(b.priceValueLabel),
        placeAName,
        placeBName,
      ),
    },
    {
      factor: "VibeGap (hype mismatch)",
      placeAValue: vibeA,
      placeBValue: vibeB,
      advantage:
        a.vibeGapScore !== null && b.vibeGapScore !== null
          ? advantageName(compareNumeric(a.vibeGapScore, b.vibeGapScore, false), placeAName, placeBName)
          : "Not enough signal",
    },
    {
      factor: "Overall decision",
      placeAValue: a.decision.label,
      placeBValue: b.decision.label,
      advantage: advantageName(
        decisionRank(a.decision.label) === decisionRank(b.decision.label)
          ? null
          : decisionRank(a.decision.label) > decisionRank(b.decision.label),
        placeAName,
        placeBName,
      ),
    },
  ];
}

function rescoreCompareSide(side: ComparePlaceSide, weights: PriorityWeights): ComparePlaceSide {
  const dimensions = extractPriorityDimensions(side.scoreBreakdown, side.place, side.reviewConfidence);
  const fitScore = computeWeightedFitScore(dimensions, weights);
  return {
    ...side,
    fitScore,
    decision: {
      ...side.decision,
      label: labelFromFit(fitScore),
    },
  };
}

function buildVerdictCopy(
  winner: ComparePlaceSide,
  other: ComparePlaceSide,
  goalDisplay: string,
): { whyWinner: string; tradeoff: string; chooseWinnerIf: string; chooseOtherIf: string } {
  const whyWinner = `Stronger fit for ${goalDisplay.toLowerCase()} with a ${winner.decision.label} read and fewer tradeoffs on wait and value in available review signals.`;
  const tradeoff = `Choose ${other.place.name} if ${other.bestFor.toLowerCase().replace(/\.$/, "")} matters more than ${winner.mainRisk.toLowerCase().replace(/\.$/, "")}.`;
  const chooseWinnerIf = `Choose ${winner.place.name} if you want the safer ${goalDisplay.toLowerCase()} fit and can accept: ${winner.mainRisk.toLowerCase().replace(/\.$/, "")}.`;
  const chooseOtherIf = `Choose ${other.place.name} if ${other.bestFor.toLowerCase().replace(/\.$/, "")} outweighs ${other.mainRisk.toLowerCase().replace(/\.$/, "")}.`;

  return { whyWinner, tradeoff, chooseWinnerIf, chooseOtherIf };
}

export function applyPriorityWeightsToCompare(
  compare: CompareResult,
  weights: PriorityWeights,
): CompareResult {
  const sideA = rescoreCompareSide(compare.sideA, weights);
  const sideB = rescoreCompareSide(compare.sideB, weights);
  const winnerKey = pickCompareWinner(sideA, sideB);
  const winner = winnerKey === "a" ? sideA : sideB;
  const other = winnerKey === "a" ? sideB : sideA;
  const copy = buildVerdictCopy(winner, other, compare.goalDisplay);

  return {
    ...compare,
    sideA,
    sideB,
    winnerPlaceId: winner.place.id,
    whyWinner: copy.whyWinner,
    tradeoff: copy.tradeoff,
    chooseWinnerIf: copy.chooseWinnerIf,
    chooseOtherIf: copy.chooseOtherIf,
    factorRows: buildFactorRows(sideA, sideB, sideA.place.name, sideB.place.name),
  };
}
