import type { DetectedIntent, PlaceData } from "@/lib/types/vibecheck";

export type IntentQualityTier = "strong" | "acceptable" | "weak" | "poor";

export type CandidateQualityGateResult = {
  isEligible: boolean;
  qualityTier: IntentQualityTier;
  intentMatchScore: number;
  penalties: string[];
  boosts: string[];
  reason: string;
};

function blob(place: PlaceData): string {
  return [
    ...place.complaints,
    ...place.positives,
    place.recentReviewSummary,
    ...place.reviewThemes.map((t) => t.label),
    place.name,
    place.category,
    ...(place.googleTypes ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function typesLower(place: PlaceData): Set<string> {
  return new Set((place.googleTypes ?? []).map((t) => t.toLowerCase()));
}

function isBrunchLikeIntent(intent: DetectedIntent): boolean {
  return (
    /\bbrunch|breakfast|coffee\b/i.test(intent.label) ||
    intent.matchedSignals.some((s) => /\bbrunch|breakfast|coffee\b/i.test(s))
  );
}

function isStudyLikeIntent(intent: DetectedIntent): boolean {
  return intent.kind === "study_work" || intent.kind === "quiet_calm";
}

function isBudgetIntent(intent: DetectedIntent): boolean {
  return intent.kind === "budget_eats" || intent.kind === "budget_celebration";
}

function isLuxuryIntent(intent: DetectedIntent): boolean {
  return intent.kind === "luxury" || intent.kind === "date_night";
}

function isLowWaitIntent(intent: DetectedIntent): boolean {
  return intent.kind === "low_wait";
}

function hasVeganGoal(intent: DetectedIntent): boolean {
  return intent.matchedSignals.some((s) => /\bvegan|vegetarian|plant[- ]based\b/i.test(s));
}

/**
 * Deterministic intent-shape gate: does not call external APIs.
 * Used to widen the candidate pool then re-rank so misfit venues (e.g. pizza for brunch) sink.
 */
export function evaluateCandidateQualityGate(place: PlaceData, intent: DetectedIntent): CandidateQualityGateResult {
  const t = typesLower(place);
  const b = blob(place);
  const penalties: string[] = [];
  const boosts: string[] = [];
  let score = 72;

  if (isBrunchLikeIntent(intent)) {
    const brunchSignals = /\bbrunch|breakfast|morning|coffee|pastry|bakery|café|cafe|eggs|pancake|bagel\b/i.test(b);
    const pizzaOnly =
      (t.has("pizza_restaurant") || /\bpizza\b/i.test(place.name)) &&
      !t.has("cafe") &&
      !t.has("bakery") &&
      !t.has("coffee_shop") &&
      !brunchSignals;
    if (pizzaOnly) {
      penalties.push("Pizza-focused type with little brunch/breakfast signal");
      score -= 38;
    }
    if (t.has("bar") || t.has("night_club")) {
      penalties.push("Bar/nightlife type is a weak brunch match");
      score -= 22;
    }
    if (t.has("tourist_attraction") && !t.has("restaurant") && !t.has("cafe") && !t.has("bakery")) {
      penalties.push("Attraction-first listing, not a meal venue");
      score -= 28;
    }
    if (t.has("cafe") || t.has("bakery") || t.has("coffee_shop") || brunchSignals) {
      boosts.push("Cafe/bakery or brunch-friendly review cues");
      score += 12;
    }
  }

  if (isStudyLikeIntent(intent)) {
    if (t.has("bar") || t.has("night_club")) {
      penalties.push("Nightlife type is a weak study match");
      score -= 30;
    }
    if (/\blibrary|bookstore|bookshop|cowork|study|quiet\b/i.test(b)) {
      boosts.push("Study- or quiet-friendly signals");
      score += 14;
    }
    if (/\bloud|packed|club|line|queue|party\b/i.test(b)) {
      penalties.push("Crowd/noise cues conflict with quiet work");
      score -= 18;
    }
  }

  if (isBudgetIntent(intent) && /\b(cheap|budget|affordable|value)\b/i.test(intent.label + " " + intent.matchedSignals.join(" "))) {
    if (place.priceLevel >= 4 && /\bexpensive|splurge|fine dining|upscale\b/i.test(b)) {
      penalties.push("Premium price cues vs budget intent");
      score -= 24;
    }
    if (/\bvalue|affordable|cheap eats|budget\b/i.test(b)) {
      boosts.push("Value-positive review themes");
      score += 10;
    }
  }

  if (isLuxuryIntent(intent)) {
    if (t.has("fast_food_restaurant") || /\bfast food|drive-?thru\b/i.test(b)) {
      penalties.push("Fast-food profile vs occasion intent");
      score -= 26;
    }
  }

  if (isLowWaitIntent(intent)) {
    if (/\b(line|queue|wait|reservation|packed)\b/i.test(b)) {
      penalties.push("Wait/line themes in reviews");
      score -= 20;
    }
  }

  if (hasVeganGoal(intent)) {
    if (/\bvegan|vegetarian|plant\b/i.test(b)) {
      boosts.push("Diet-friendly review cues");
      score += 10;
    }
    if (/\bmeat|bbq|steakhouse\b/i.test(place.category.toLowerCase()) && !/\bvegan|vegetarian\b/i.test(b)) {
      penalties.push("Meat-forward venue with weak plant-based signals");
      score -= 16;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let qualityTier: IntentQualityTier;
  if (score >= 78) qualityTier = "strong";
  else if (score >= 58) qualityTier = "acceptable";
  else if (score >= 38) qualityTier = "weak";
  else qualityTier = "poor";

  const isEligible = qualityTier !== "poor";
  const reason =
    boosts[0] ??
    (penalties[0] ? `Adjusted for intent fit: ${penalties[0]}.` : "Intent signals look broadly compatible.");

  return {
    isEligible,
    qualityTier,
    intentMatchScore: score,
    penalties,
    boosts,
    reason,
  };
}
