import { rankCandidatesByIntent } from "@/lib/ai/candidateRanker";
import {
  buildGoalCompareInitialVerdict,
  buildNoGoalCompareVerdict,
  buildUnmappedGoalCompareVerdict,
} from "@/lib/ai/compareVerdictCopy";
import { augmentPlaceQueryWithInheritedCity, extractTrailingCityFromPlaceQuery } from "@/lib/ai/comparePlaceContext";
import type { ParsedCompareQuery } from "@/lib/ai/compareQuery";
import { classifyQueryMode } from "@/lib/ai/queryMode";
import { resolveCompareTuningFamily } from "@/lib/ai/priorityTuning";
import {
  buildMockVibeReport,
  detectIntentFromQuery,
  resolveCompareReportIntent,
} from "@/lib/ai/truthEngine";
import type {
  CompareFactorRow,
  ComparePlaceSide,
  CompareResult,
  DecisionConfidence,
  DecisionLabel,
  DetectedIntent,
  VibeReport,
} from "@/lib/types/vibecheck";

function riskLabelFromScore(score: number, invertBetter = false): string {
  const effective = invertBetter ? 100 - score : score;
  if (effective >= 66) return "High";
  if (effective >= 40) return "Medium";
  return "Low";
}

function riskRank(label: string): number {
  if (label === "Low") return 0;
  if (label === "High") return 2;
  return 1;
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

function advantageName(
  betterIsA: boolean | null,
  placeAName: string,
  placeBName: string,
): string {
  if (betterIsA === null) return "Tie";
  return betterIsA ? placeAName : placeBName;
}

function compareNumeric(a: number, b: number, higherWins: boolean): boolean | null {
  const diff = Math.abs(a - b);
  if (diff < 4) return null;
  return higherWins ? a > b : a < b;
}

async function buildSide(
  placeName: string,
  goalText: string,
  detectedIntent: DetectedIntent,
): Promise<{ side: ComparePlaceSide; report: VibeReport; googleResolved: boolean }> {
  const syntheticQuery = `${placeName} for ${goalText}`;
  const report = await buildMockVibeReport(syntheticQuery);
  const ranked = rankCandidatesByIntent([report.place], detectedIntent)[0]!;
  const googleResolved =
    report.place.dataSource === "google" && report.googlePlacesFallback === "none";

  const side: ComparePlaceSide = {
    place: report.place,
    decision: report.decision,
    fitScore: report.score.intentFitScore,
    vibeGapScore: report.score.vibeGapScore,
    waitRiskLabel: riskLabelFromScore(report.score.waitRiskScore),
    noiseCrowdingLabel: riskLabelFromScore(report.score.touristDensityScore),
    priceValueLabel: riskLabelFromScore(report.score.priceRealityScore),
    reviewConfidence: report.decision.confidence,
    mainRisk: ranked.mainRisk,
    bestFor: ranked.bestFor,
    avoidIf: ranked.avoidIf,
    topReasons: [...report.quickVerdict.evidenceBullets],
    scoreBreakdown: ranked.scoreBreakdown,
    googleResolved,
  };

  return { side, report, googleResolved };
}

function pickWinner(a: ComparePlaceSide, b: ComparePlaceSide): "a" | "b" {
  if (a.fitScore !== b.fitScore) {
    return a.fitScore > b.fitScore ? "a" : "b";
  }
  const dr = decisionRank(a.decision.label) - decisionRank(b.decision.label);
  if (dr !== 0) return dr > 0 ? "a" : "b";
  if (a.vibeGapScore !== null && b.vibeGapScore !== null && a.vibeGapScore !== b.vibeGapScore) {
    return a.vibeGapScore < b.vibeGapScore ? "a" : "b";
  }
  if (a.waitRiskLabel !== b.waitRiskLabel) {
    const order = { Low: 0, Medium: 1, High: 2 };
    return order[a.waitRiskLabel as keyof typeof order] < order[b.waitRiskLabel as keyof typeof order] ? "a" : "b";
  }
  return "a";
}

function buildFactorRows(
  a: ComparePlaceSide,
  b: ComparePlaceSide,
  placeAName: string,
  placeBName: string,
): CompareFactorRow[] {
  const vibeA =
    a.vibeGapScore !== null ? String(a.vibeGapScore) : "Not enough signal";
  const vibeB =
    b.vibeGapScore !== null ? String(b.vibeGapScore) : "Not enough signal";

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
        a.waitRiskLabel === b.waitRiskLabel
          ? null
          : riskRank(a.waitRiskLabel) < riskRank(b.waitRiskLabel),
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
      factor: "Signal gap",
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

/** User-facing compare headline fragment (not internal enum labels). */
function formatCompareGoalDisplay(goalText: string, intent: DetectedIntent): string {
  const g = goalText.trim();
  if (g.length >= 2 && g.toLowerCase() !== "your visit") {
    return g[0]!.toUpperCase() + g.slice(1);
  }
  if (intent.kind !== "venue_lookup") {
    return intent.label;
  }
  return "General visit";
}

export async function buildCompareModeResult(
  searchQuery: string,
  parsed: ParsedCompareQuery,
): Promise<CompareResult> {
  const goalQuery = `${parsed.placeA} for ${parsed.goalText}`;
  const intentInitial = detectIntentFromQuery(goalQuery);
  const classification = classifyQueryMode(goalQuery, intentInitial);
  const detectedIntent = resolveCompareReportIntent(goalQuery, parsed.goalText, classification);

  const sharedContextCity = parsed.compareContextCity?.trim() || null;
  const cityFromA = extractTrailingCityFromPlaceQuery(parsed.placeA);
  const cityFromB = extractTrailingCityFromPlaceQuery(parsed.placeB);
  let placeAForSearch = augmentPlaceQueryWithInheritedCity(parsed.placeA, cityFromB);
  let placeBForSearch = augmentPlaceQueryWithInheritedCity(parsed.placeB, cityFromA);
  placeAForSearch = augmentPlaceQueryWithInheritedCity(placeAForSearch, sharedContextCity);
  placeBForSearch = augmentPlaceQueryWithInheritedCity(placeBForSearch, sharedContextCity);

  const hasGoogleKey = Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());

  const [builtA, builtB] = await Promise.all([
    buildSide(placeAForSearch, parsed.goalText, detectedIntent),
    buildSide(placeBForSearch, parsed.goalText, detectedIntent),
  ]);

  let partialResolveMessage: string | null = null;
  if (hasGoogleKey) {
    const resolvedCount = (builtA.googleResolved ? 1 : 0) + (builtB.googleResolved ? 1 : 0);
    if (resolvedCount === 1) {
      partialResolveMessage =
        "I could only resolve one of the places. Try adding a city for both.";
    }
  }

  const sideA = builtA.side;
  const sideB = builtB.side;
  const winnerKey = pickWinner(sideA, sideB);
  const winner = winnerKey === "a" ? sideA : sideB;
  const other = winnerKey === "a" ? sideB : sideA;

  const goalDisplay = formatCompareGoalDisplay(parsed.goalText, detectedIntent);
  const compareHasParsedGoal = parsed.goalText.trim().toLowerCase() !== "your visit";
  const compareTuningFamily = compareHasParsedGoal
    ? resolveCompareTuningFamily(detectedIntent, parsed.goalText)
    : null;
  const compareAllowsPriorityTuning = compareTuningFamily !== null;

  const copy = !compareHasParsedGoal
    ? buildNoGoalCompareVerdict(winner, other)
    : compareTuningFamily
      ? buildGoalCompareInitialVerdict(winner, other, goalDisplay, compareTuningFamily)
      : buildUnmappedGoalCompareVerdict(winner, other, goalDisplay);

  const compareHeadlineTitle =
    goalDisplay === "General visit" ? "Comparing two venues" : `Best choice for ${goalDisplay}`;
  const compareHeadlineSubtitle =
    sharedContextCity && sharedContextCity.length > 0
      ? `Comparing ${parsed.placeA} and ${parsed.placeB} in ${sharedContextCity}.`
      : `Comparing ${parsed.placeA} and ${parsed.placeB}.`;

  return {
    searchQueryDisplay: searchQuery.trim(),
    detectedIntent,
    goalDisplay,
    compareHeadlineTitle,
    compareHeadlineSubtitle,
    compareHasParsedGoal,
    compareAllowsPriorityTuning,
    compareTuningFamily,
    placeAName: sideA.place.name,
    placeBName: sideB.place.name,
    sideA,
    sideB,
    winnerPlaceId: winner.place.id,
    whyWinner: copy.whyWinner,
    tradeoff: copy.tradeoff,
    chooseWinnerIf: copy.chooseWinnerIf,
    chooseOtherIf: copy.chooseOtherIf,
    factorRows: buildFactorRows(sideA, sideB, sideA.place.name, sideB.place.name),
    partialResolveMessage,
  };
}
