import type {
  DetectedIntent,
  RecommendationInsights,
  RecommendationScoringWeight,
  RankedCandidate,
} from "@/lib/types/vibecheck";

function weightsForIntent(intent: DetectedIntent): RecommendationScoringWeight[] {
  switch (intent.kind) {
    case "study_work":
    case "quiet_calm":
      return [
        { label: "Quiet/work fit", weight: 40 },
        { label: "Noise/crowding risk", weight: 25 },
        { label: "Review strength", weight: 15 },
        { label: "Price/accessibility", weight: 10 },
        { label: "Confidence", weight: 10 },
      ];
    case "budget_celebration":
    case "budget_eats":
      return [
        { label: "Budget/value fit", weight: 35 },
        { label: "Group/celebration fit", weight: 25 },
        { label: "Wait/reservation risk", weight: 20 },
        { label: "Review strength", weight: 10 },
        { label: "Confidence", weight: 10 },
      ];
    case "luxury":
    case "date_night":
      return [
        { label: "Occasion fit", weight: 35 },
        { label: "Ambience/reputation", weight: 25 },
        { label: "Reservation risk", weight: 15 },
        { label: "Review strength", weight: 15 },
        { label: "Confidence", weight: 10 },
      ];
    case "party_nightlife":
      return [
        { label: "Energy/nightlife fit", weight: 35 },
        { label: "Queue/wait risk", weight: 20 },
        { label: "Review strength", weight: 20 },
        { label: "Access/timing", weight: 15 },
        { label: "Confidence", weight: 10 },
      ];
    case "low_wait":
      return [
        { label: "Low-wait fit", weight: 40 },
        { label: "Queue/reservation risk", weight: 25 },
        { label: "Crowding risk", weight: 15 },
        { label: "Review strength", weight: 10 },
        { label: "Confidence", weight: 10 },
      ];
    default:
      return [
        { label: "Goal fit", weight: 35 },
        { label: "Risk profile", weight: 25 },
        { label: "Review strength", weight: 20 },
        { label: "Price/access", weight: 10 },
        { label: "Confidence", weight: 10 },
      ];
  }
}

function topPickReason(intent: DetectedIntent): string {
  switch (intent.kind) {
    case "study_work":
    case "quiet_calm":
      return "Best balance of study-friendly context, rating quality, and manageable crowd risk.";
    case "budget_celebration":
    case "budget_eats":
      return "Best balance of value fit, celebration practicality, and wait-risk control.";
    case "luxury":
    case "date_night":
      return "Best balance of occasion fit, ambience reputation, and reservation reliability.";
    case "party_nightlife":
      return "Best balance of nightlife energy, crowd expectations, and queue risk.";
    case "low_wait":
      return "Best balance of low-wait potential and reservation friction control.";
    default:
      return "Best overall fit across current ranking weights and risk signals.";
  }
}

function tradeoff(intent: DetectedIntent): { mainTradeoff: string; strongestRisk: string } {
  switch (intent.kind) {
    case "study_work":
    case "quiet_calm":
      return {
        mainTradeoff: "Quiet fit vs. peak-hour crowd risk.",
        strongestRisk: "Noise or seating pressure during busy hours.",
      };
    case "budget_celebration":
    case "budget_eats":
      return {
        mainTradeoff: "Budget fit vs. reservation and timing friction.",
        strongestRisk: "Price mismatch or long waits at peak dinner slots.",
      };
    case "luxury":
    case "date_night":
      return {
        mainTradeoff: "Occasion polish vs. reservation reliability.",
        strongestRisk: "Atmosphere mismatch if timing or table flow is off.",
      };
    case "party_nightlife":
      return {
        mainTradeoff: "Energy fit vs. queue and pacing friction.",
        strongestRisk: "Long entry lines or crowding spikes at peak hours.",
      };
    case "low_wait":
      return {
        mainTradeoff: "Fast access vs. crowd/queue variability.",
        strongestRisk: "Line and reservation friction during rush windows.",
      };
    default:
      return {
        mainTradeoff: "Fit score vs. reliability risk.",
        strongestRisk: "Signal uncertainty across candidates.",
      };
  }
}

export function buildRecommendationInsights(
  candidates: RankedCandidate[],
  detectedIntent: DetectedIntent,
  locationCandidate: string,
): RecommendationInsights {
  const top = candidates[0];
  const go = candidates.filter((c) => c.decision.label === "GO").length;
  const maybe = candidates.filter((c) => c.decision.label === "MAYBE").length;
  const skip = candidates.filter((c) => c.decision.label === "SKIP").length;
  const { mainTradeoff, strongestRisk } = tradeoff(detectedIntent);

  const confidenceNote =
    "Google Places data powers venue details and review signals when available. Social comparison remains mocked in this prototype.";

  return {
    topPickName: top?.place.name ?? `Top pick in ${locationCandidate}`,
    topPickReason: top ? topPickReason(detectedIntent) : "No ranked candidates were available for this query.",
    decisionSummary: `${go} GO · ${maybe} MAYBE · ${skip} SKIP`,
    mainTradeoff,
    strongestRisk,
    confidenceNote,
    scoringWeights: weightsForIntent(detectedIntent),
    decisionCounts: { go, maybe, skip },
    whyRankedFirstBullets: top
      ? [
          `Strongest driver: ${top.scoreDriver}.`,
          `Main risk to watch: ${top.mainRisk}.`,
          candidates[1]
            ? `Beats the next option by ${top.fitScore - candidates[1].fitScore} fit points in this scoring model.`
            : "No close second candidate was available in this run.",
        ]
      : [
          "No ranked candidate available.",
          "Risk and fit trade-offs could not be compared.",
          "Try refining the location or query wording.",
        ],
  };
}
