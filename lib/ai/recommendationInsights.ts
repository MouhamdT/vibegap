import type {
  DetectedIntent,
  RankedCandidate,
  RecommendationInsights,
  RecommendationScoringWeight,
} from "@/lib/types/vibecheck";
import { PRODUCT_HONESTY_FULL } from "@/lib/copy/productHonesty";

function looksStudyishPlace(place: { name: string; category: string }): boolean {
  const text = `${place.category} ${place.name}`.toLowerCase();
  return /\blibrary|bookstore|book shop|bookshop|study|cowork|co-working|workspace|reading room|book cafe\b/.test(text);
}

function looksCafeCoffee(place: { name: string; category: string }): boolean {
  const text = `${place.category} ${place.name}`.toLowerCase();
  return /\bcafe|coffee|espresso|roaster|cup\b/.test(text);
}

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

function whyItWonSentence(top: RankedCandidate, intent: DetectedIntent): string {
  const driver = top.scoreDriver;
  const rc = top.place.reviewCount;
  const k = intent.kind;

  if (k === "study_work" || k === "quiet_calm") {
    if (looksStudyishPlace(top.place)) {
      return `Best balance of study-friendly context, review depth (${rc.toLocaleString()} reviews), and manageable crowd risk — strongest driver: ${driver}.`;
    }
    return `Leads on fit (${top.fitScore}) with ${driver.toLowerCase()} as the clearest signal in available review themes.`;
  }
  if (k === "budget_celebration" || k === "budget_eats") {
    return `Strong value and celebration practicality versus the rest of this shortlist — strongest driver: ${driver}.`;
  }
  if (k === "luxury" || k === "date_night") {
    return `Strong occasion fit with premium atmosphere cues and broad review coverage — strongest driver: ${driver}.`;
  }
  if (k === "party_nightlife") {
    return `Best energy alignment for a night out without giving up as much queue risk as lower-ranked picks — strongest driver: ${driver}.`;
  }
  if (k === "low_wait") {
    return `Best balance of lower queue friction in the available signals versus peers — strongest driver: ${driver}.`;
  }
  if (intent.label === "Brunch" || intent.label === "Coffee" || intent.label === "Dining") {
    return `Best balance of meal fit, location context, and review strength in this draw — strongest driver: ${driver}.`;
  }
  return `Best current match on fit score (${top.fitScore}) with ${driver.toLowerCase()} as the main driver versus alternatives in this shortlist.`;
}

function mainTradeoffSentence(top: RankedCandidate, intent: DetectedIntent): string {
  const risk = top.mainRisk;
  const k = intent.kind;
  if (k === "study_work" || k === "quiet_calm") {
    return `Peak-hour noise and seating pressure can still hurt deep focus — watch: ${risk}.`;
  }
  if (k === "budget_celebration" || k === "budget_eats") {
    return `Reservation timing and group tabs can still bite — main practical risk: ${risk}.`;
  }
  if (k === "luxury" || k === "date_night") {
    return `Reservation pressure and night-to-night consistency remain the main downside — ${risk}.`;
  }
  if (k === "party_nightlife") {
    return `Queues and pacing swing harder by night — main tradeoff: ${risk}.`;
  }
  if (k === "low_wait") {
    return `Line and reservation themes in reviews can still clash with a strict no-wait plan — ${risk}.`;
  }
  if (intent.label === "Brunch" || intent.label === "Coffee" || intent.label === "Dining") {
    return `Tourist-area crowding or wait timing may still affect the meal experience — ${risk}.`;
  }
  return `The main weakness to underwrite is ${risk.toLowerCase()} — weigh that against the fit score before you commit.`;
}

function bestAlternativeIfSentence(candidates: RankedCandidate[], intent: DetectedIntent): string {
  if (candidates.length < 2) {
    return "No strong second option in this shortlist — try widening the neighborhood or tightening one priority (price vs. ambience vs. wait).";
  }
  const top = candidates[0]!;
  const alt = candidates[1]!;
  const name = alt.place.name;
  const k = intent.kind;

  if (k === "study_work" || k === "quiet_calm") {
    if (looksStudyishPlace(top.place) && looksCafeCoffee(alt.place) && !looksCafeCoffee(top.place)) {
      return `Choose ${name} if you prefer a more classic café setting and accept more crowding risk.`;
    }
    if (alt.fitScore >= top.fitScore - 6 && alt.scoreDriver !== top.scoreDriver) {
      return `Choose ${name} if ${alt.scoreDriver.toLowerCase()} matters more than ${top.scoreDriver.toLowerCase()} for your session.`;
    }
    return `Choose ${name} if you want a different noise profile and can trade a few fit points for that tradeoff.`;
  }
  if (k === "budget_celebration" || k === "budget_eats") {
    if (alt.place.priceLevel < top.place.priceLevel) {
      return `Choose ${name} if price/value matters more than view or atmosphere.`;
    }
    return `Choose ${name} if you want a tighter value read and accept a bit more reservation or wait risk.`;
  }
  if (k === "luxury" || k === "date_night") {
    return `Choose ${name} if you want a livelier, buzzier celebration atmosphere and accept more noise energy.`;
  }
  if (k === "low_wait") {
    return `Choose ${name} if you want lower wait risk in the review snapshot and can flex on ambience or menu breadth.`;
  }
  if (intent.label === "Brunch" || intent.label === "Coffee" || intent.label === "Dining") {
    return `Choose ${name} if you want lower wait risk or better value and can trade a bit of “default best” meal fit.`;
  }
  return `Choose ${name} if your priority shifts toward ${alt.scoreDriver.toLowerCase()} rather than ${top.scoreDriver.toLowerCase()}.`;
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

  const strongestRisk =
    top?.mainRisk ?? "Signal depth across candidates is thinner than ideal for a pick with strong confidence.";

  const weakGate = candidates.some((c) => c.intentQualityTier === "weak" || c.intentQualityTier === "poor");
  const confidenceNote = weakGate
    ? `${PRODUCT_HONESTY_FULL} Ranked after a light intent-shape filter on place types and review themes — some picks are weaker matches but were the best available in this search area.`
    : PRODUCT_HONESTY_FULL;

  return {
    topPickName: top?.place.name ?? `Top pick in ${locationCandidate}`,
    whyItWon: top ? whyItWonSentence(top, detectedIntent) : "No ranked candidates were available for this query.",
    mainTradeoff: top ? mainTradeoffSentence(top, detectedIntent) : "Run a search to compare tradeoffs across real candidates.",
    bestAlternativeIf: bestAlternativeIfSentence(candidates, detectedIntent),
    decisionSummary: `${go} GO · ${maybe} MAYBE · ${skip} SKIP`,
    strongestRisk,
    confidenceNote,
    scoringWeights: weightsForIntent(detectedIntent),
    decisionCounts: { go, maybe, skip },
    whyRankedFirstBullets: top
      ? [
          `Strongest driver: ${top.scoreDriver}.`,
          `Main risk to watch: ${top.mainRisk}.`,
          candidates[1]
            ? `Beats ${candidates[1].place.name} by ${top.fitScore - candidates[1].fitScore} fit points in this scoring model.`
            : "No close second candidate was available in this run.",
        ]
      : [
          "No ranked candidate available.",
          "Risk and fit trade-offs could not be compared.",
          "Try refining the location or query wording.",
        ],
  };
}
