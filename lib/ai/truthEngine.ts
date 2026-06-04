import { buildSinglePlaceGeography } from "@/lib/geo/buildSinglePlaceGeography";
import { classifyQueryMode, type QueryClassification } from "@/lib/ai/queryMode";
import { PRODUCT_HONESTY_FULL } from "@/lib/copy/productHonesty";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { resolvePlaceForReport } from "@/lib/places/resolvePlaceForReport";
import { getMockSocialContentMode, getMockSocialForPlace } from "@/lib/social/mockSocialProvider";
import type {
  DecisionSummary,
  DetectedIntent,
  PlaceData,
  QueryMode,
  QuickVerdict,
  Recommendation,
  SocialPost,
  UserIntentKind,
  VibeGapScore,
  VibeReport,
} from "@/lib/types/vibecheck";

/** Signal gap score: low = goal-cue text and reviews align; high = they diverge. */
const GAP_LOW_MAX = 32;
const GAP_MED_MAX = 64;

export function resolveReportIntent(searchQuery: string, classification: { queryMode: QueryMode; intentGoalText: string | null }): DetectedIntent {
  if (classification.queryMode !== "place_with_intent") {
    return detectIntentFromQuery(searchQuery);
  }
  const tail = classification.intentGoalText?.trim();
  if (!tail) return detectIntentFromQuery(searchQuery);
  const fullIntent = detectIntentFromQuery(searchQuery);
  const tailIntent = detectIntentFromQuery(tail);
  if (fullIntent.kind !== "venue_lookup") return fullIntent;
  if (tailIntent.kind !== "venue_lookup") return tailIntent;
  return fullIntent;
}

/** Compare mode: always let the parsed goal clause participate in tail intent resolution. */
export function resolveCompareReportIntent(
  goalQuery: string,
  parsedGoalText: string,
  classification: QueryClassification,
): DetectedIntent {
  const trimmed = parsedGoalText.trim();
  const isGenericGoal = trimmed.length < 2 || trimmed.toLowerCase() === "your visit";
  if (isGenericGoal) {
    return resolveReportIntent(goalQuery, classification);
  }
  return resolveReportIntent(goalQuery, {
    ...classification,
    queryMode: "place_with_intent",
    intentGoalText: trimmed,
  });
}

function formatPlaceIntentGoalDisplay(goalFragment: string, intent: DetectedIntent): string {
  switch (intent.kind) {
    case "low_wait":
      return "Low-wait visit";
    case "quiet_calm":
      return "Quiet visit";
    case "study_work":
      return "Study-focused visit";
    case "budget_celebration":
      return "Budget-friendly celebration";
    case "budget_eats":
      return "Budget-conscious meal";
    case "date_night":
      return "Date night";
    case "party_nightlife":
      return "Night out";
    case "family":
      return "Family outing";
    case "luxury":
      return "Upscale visit";
    default: {
      const g = formatSearchQueryForDisplay(goalFragment);
      return `${g} visit`;
    }
  }
}

/** True when review themes/snippets are sourced from Google Places. */
function usesGoogleReviewSignals(place: PlaceData): boolean {
  return place.dataSource === "google" && Boolean(place.hasRealGoogleReviews);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a full place report. Scoring is split into:
 * - Signal gap: goal-cue text vs. review narrative (never uses “user goal” rules).
 * - Intent Fit: inferred query goal vs. what reviews + framing cues imply about the visit.
 */
export async function buildMockVibeReport(searchQuery: string): Promise<VibeReport> {
  const intentInitial = detectIntentFromQuery(searchQuery);
  const classification = classifyQueryMode(searchQuery, intentInitial);
  const detectedIntent = resolveReportIntent(searchQuery, classification);
  const resolvedPlace = await resolvePlaceForReport(searchQuery, classification, detectedIntent);
  const { place, googlePlacesFallback, suggestPlaceDisambiguation } = resolvedPlace;
  const socialHighlights = getMockSocialForPlace(place);

  const hypeIndex = averageHypeIndex(socialHighlights);
  const socialBlob = joinSocialText(socialHighlights);
  const reviewBlob = buildReviewBlob(place);

  const mismatch = buildSocialReviewMismatch(socialHighlights, reviewBlob, place);
  const realityIndex = computeRealityIndex(place, reviewBlob, mismatch.crowdedReality, mismatch.expensiveReality);
  const divergence = computeHypeRealityDivergence(hypeIndex, realityIndex);

  const vibeGapScore = finalizeVibeGapScore(mismatch, divergence, place);
  const verdict = verdictForVibeGap(vibeGapScore);

  const auxiliary = computeAuxiliaryScores(place, reviewBlob, socialBlob, mismatch);

  const intentFit = computeIntentFitScore(
    detectedIntent,
    socialBlob,
    reviewBlob,
    place,
    mismatch.socialMode,
    auxiliary.laptopFriendlyScore,
  );

  const score: VibeGapScore = {
    vibeGapScore,
    intentFitScore: intentFit.score,
    intentFitVerdict: intentFit.verdict,
    touristDensityScore: auxiliary.touristDensityScore,
    waitRiskScore: auxiliary.waitRiskScore,
    laptopFriendlyScore: auxiliary.laptopFriendlyScore,
    priceRealityScore: auxiliary.priceRealityScore,
    verdict,
    hypeIndex,
    realityIndex,
    vibeGapExplanationBullets: mismatch.vibeGapBullets,
    intentFitExplanationBullets: intentFit.bullets,
  };

  const placeIntentGoalDisplay =
    classification.queryMode === "place_with_intent" && classification.intentGoalText?.trim()
      ? formatPlaceIntentGoalDisplay(classification.intentGoalText.trim(), detectedIntent)
      : null;

  const quickVerdict = buildQuickVerdict({
    place,
    score,
    detectedIntent,
    mismatch,
    reviewBlob,
    socialBlob,
    queryMode: classification.queryMode,
  });

  const socialSummary = summarizeSocialHype(socialHighlights, mismatch.socialMode);
  const realitySummary = buildRealitySummary(place);
  const decision = buildDecisionSummary({
    score,
    intent: detectedIntent,
    place,
  });
  const { bestFor, avoidIf } = deriveTags(place, score, detectedIntent);
  const recommendation = buildRecommendation(
    vibeGapScore,
    intentFit.score,
    detectedIntent,
    place,
    bestFor,
    avoidIf,
  );

  const geography = await buildSinglePlaceGeography(searchQuery, classification, place);

  return {
    searchQueryDisplay: formatSearchQueryForDisplay(searchQuery),
    queryMode: classification.queryMode,
    placeNameCandidate: classification.placeNameCandidate,
    queryExplanation: classification.queryExplanation,
    queryContextBanner: classification.queryContextBanner,
    placeIntentGoalDisplay,
    googlePlacesFallback,
    suggestPlaceDisambiguation,
    place,
    socialHighlights,
    socialSummary,
    realitySummary,
    score,
    detectedIntent,
    decision,
    quickVerdict,
    bestFor,
    avoidIf,
    recommendation,
    generatedAt: new Date().toISOString(),
    narrativeSource: "rules",
    aiNarrativeUsed: false,
    ...(geography ? { geography } : {}),
  };
}

// ---------------------------------------------------------------------------
// Intent detection (search query only)
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<UserIntentKind, readonly string[]> = {
  study_work: ["study", "studying", "laptop", "wifi", "work", "homework", "focus", "reading", "to study"],
  low_wait: [
    "no waiting line",
    "no waiting time",
    "no wait",
    "low wait",
    "short wait",
    "no line",
    "no queue",
    "without waiting",
    "not crowded",
    "avoid line",
    "avoid queue",
    "reservation easy",
    "walk in",
    "walk-in",
    "quick seating",
  ],
  date_night: ["date", "romantic", "anniversary", "proposal", "couples"],
  budget_celebration: [
    "cheap",
    "budget",
    "celebrate",
    "celebration",
    "birthday",
    "restaurant",
    "resturant",
    "dinner",
  ],
  budget_eats: ["cheap", "budget", "affordable", "inexpensive", "deal", "value", "vegan", "vegetarian"],
  luxury: ["luxury", "splurge", "fancy", "special", "tasting", "celebration", "upscale"],
  quiet_calm: [
    "quiet",
    "calm",
    "peaceful",
    "chill",
    "low key",
    "low-key",
    "serene",
  ],
  party_nightlife: ["party", "nightlife", "dancing", "dj", "club", "drinks", "shots", "turn up"],
  family: ["family", "kids", "children", "toddler", "stroller", "baby"],
  venue_lookup: [],
};

const BUDGET_CELEBRATION_BUDGET: readonly string[] = [
  "cheap",
  "budget",
  "affordable",
  "inexpensive",
  "deal",
  "value",
];
const BUDGET_CELEBRATION_OCCASION: readonly string[] = [
  "celebrate",
  "celebration",
  "birthday",
  "anniversary",
  "occasion",
  "gathering",
];
const BUDGET_CELEBRATION_FOOD: readonly string[] = [
  "restaurant",
  "resturant",
  "dinner",
  "brunch",
  "lunch",
  "eatery",
  "bistro",
  "cafe",
];

function matchBudgetCelebrationQuery(query: string): { matched: boolean; signals: string[] } {
  const hasBudget = collectHits(query, BUDGET_CELEBRATION_BUDGET).length > 0 || /\bcheap\b/.test(query);
  const occasionHits = collectHits(query, BUDGET_CELEBRATION_OCCASION);
  const foodHits = collectHits(query, BUDGET_CELEBRATION_FOOD);
  const hasOccasion =
    occasionHits.length > 0 || /\b(celebrate|celebration|birthdays?)\b/.test(query);
  const hasFood = foodHits.length > 0;
  const celebrationInQuery =
    /\b(celebrate|celebration|birthday|anniversary|occasion|gathering)\b/.test(query);
  const matched =
    hasBudget &&
    (hasOccasion || (hasFood && celebrationInQuery));
  const signals = [
    ...new Set([
      ...collectHits(query, BUDGET_CELEBRATION_BUDGET),
      ...occasionHits,
      ...foodHits,
    ]),
  ].slice(0, 8);
  return { matched, signals };
}

/**
 * Reads the raw query and returns a single primary intent.
 * Venue-style names without goal words resolve to `venue_lookup` (neutral intent).
 */
export function detectIntentFromQuery(rawQuery: string): DetectedIntent {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return {
      kind: "venue_lookup",
      label: "Venue lookup",
      confidence: "low",
      matchedSignals: [],
    };
  }

  const lowWaitHits = collectHits(query, INTENT_KEYWORDS.low_wait);
  if (
    lowWaitHits.length > 0 ||
    /\b(no waiting (line|time)|no wait|low wait|short wait|no line|no queue|without waiting|not crowded|avoid (line|queue)|reservation easy|walk-?in)\b/.test(
      query,
    )
  ) {
    const signals = [...new Set(lowWaitHits)].slice(0, 6);
    return {
      kind: "low_wait",
      label: "Low-wait visit",
      confidence: signals.length >= 2 ? "high" : "medium",
      matchedSignals: signals.length > 0 ? signals : ["low wait"],
    };
  }

  const studyHits = collectHits(query, INTENT_KEYWORDS.study_work);
  const quietHits = collectHits(query, INTENT_KEYWORDS.quiet_calm);
  if (studyHits.length > 0 || (quietHits.length > 0 && /\b(study|laptop|work|read)\b/.test(query))) {
    const signals = [...new Set([...studyHits, ...quietHits])].slice(0, 6);
    return {
      kind: "study_work",
      label: "Quiet work or study session",
      confidence: signals.length >= 2 ? "high" : "medium",
      matchedSignals: signals,
    };
  }

  if (quietHits.length > 0) {
    return {
      kind: "quiet_calm",
      label: "A calm, low-noise visit",
      confidence: quietHits.length >= 2 ? "high" : "medium",
      matchedSignals: quietHits,
    };
  }

  const specialOccasionMeal =
    /\b(birthday|anniversary)\b/.test(query) &&
    /\b(dinner|lunch|brunch|breakfast|meal|celebration|party|drinks|reservation|evening)\b/.test(query);
  if (specialOccasionMeal) {
    return {
      kind: "luxury",
      label: "Special-occasion meal",
      confidence: "medium",
      matchedSignals: ["occasion", "meal context"],
    };
  }

  const partyHits = collectHits(query, INTENT_KEYWORDS.party_nightlife);
  if (partyHits.length > 0) {
    return {
      kind: "party_nightlife",
      label: "High-energy night out",
      confidence: "medium",
      matchedSignals: partyHits,
    };
  }

  const budgetCelebration = matchBudgetCelebrationQuery(query);
  if (budgetCelebration.matched) {
    return {
      kind: "budget_celebration",
      label: "Budget-friendly celebration meal",
      confidence: budgetCelebration.signals.length >= 3 ? "high" : "medium",
      matchedSignals: budgetCelebration.signals,
    };
  }

  const dateHits = collectHits(query, INTENT_KEYWORDS.date_night);
  if (dateHits.length > 0) {
    return {
      kind: "date_night",
      label: "Date night or romantic table",
      confidence: "medium",
      matchedSignals: dateHits,
    };
  }

  const familyHits = collectHits(query, INTENT_KEYWORDS.family);
  if (familyHits.length > 0) {
    return {
      kind: "family",
      label: "Family-friendly outing",
      confidence: "medium",
      matchedSignals: familyHits,
    };
  }

  const budgetHits = collectHits(query, INTENT_KEYWORDS.budget_eats);
  if (budgetHits.length > 0) {
    return {
      kind: "budget_eats",
      label: "Budget-conscious meal",
      confidence: "medium",
      matchedSignals: budgetHits,
    };
  }

  const luxuryHits = collectHits(query, INTENT_KEYWORDS.luxury);
  if (luxuryHits.length > 0) {
    return {
      kind: "luxury",
      label: "Upscale or special-occasion visit",
      confidence: "medium",
      matchedSignals: luxuryHits,
    };
  }

  return {
    kind: "venue_lookup",
    label: "Venue lookup (no specific goal detected)",
    confidence: "low",
    matchedSignals: [],
  };
}

function collectHits(query: string, keywords: readonly string[]): string[] {
  return keywords.filter((k) => query.includes(k));
}

// ---------------------------------------------------------------------------
// Signal gap: goal-cue text vs. reviews
// ---------------------------------------------------------------------------

type MismatchSignals = {
  socialMode: "calm" | "lively";
  hiddenGemHype: boolean;
  /** True when the calm clip pack promises easy, quiet, or study-friendly access (visible captions + tags). */
  socialCalmPackActive: boolean;
  cheapSocial: boolean;
  effortlessAccessSocial: boolean;
  crowdedReality: boolean;
  expensiveReality: boolean;
  waitReality: boolean;
  highReviewVolume: boolean;
  /** goal-cue text cards and reviews both describe a busy / loud / wait-heavy room. */
  socialReviewAgreeBusy: boolean;
  vibeGapBullets: string[];
  /** Points driving VibeGap up — excludes “agreement” bullets (score stays low when aligned). */
  mismatchPoints: number;
};

/**
 * Compares **visible** goal-cue text cards to review text. Uses the same calm vs. lively pack as the UI
 * (`getMockSocialContentMode`) so rationale never claims “calm cards” when the lively pack is showing.
 */
function buildSocialReviewMismatch(
  posts: SocialPost[],
  reviewBlob: string,
  place: PlaceData,
): MismatchSignals {
  const socialBlob = joinSocialText(posts);
  const socialMode = getMockSocialContentMode(place);
  const socialCalmPackActive = socialMode === "calm";

  const hiddenGemHype = /\b(hidden gem|underrated|nobody|secret|locals only|off the radar)\b/i.test(
    socialBlob,
  );
  const cheapSocial = /\b(cheap|budget|steal|cash-only|huge portions)\b/i.test(socialBlob);
  const effortlessAccessSocial =
    socialCalmPackActive &&
    /\b(no wait|empty|zero wait|walk-in friendly|walk-in|zero lines)\b/i.test(socialBlob);

  const crowdedReality = /\b(crowd|loud|noise|line|wait|packed|busy|reservation)\b/i.test(reviewBlob);
  const expensiveReality =
    /\b(expensive|overpriced|price|small portions|not worth)\b/i.test(reviewBlob) || place.priceLevel >= 3;
  const waitReality = /\b(line|wait|slow turn|reservation|packed)\b/i.test(reviewBlob);
  const highReviewVolume = place.reviewCount > 900;

  const socialBusyPack = socialMode === "lively";
  const socialReviewAgreeBusy = socialBusyPack && crowdedReality;

  const vibeGapBullets: string[] = [];
  let mismatchPoints = 0;

  const tagSample = sampleVisibleVibeTags(posts);
  const reviewSample = sampleReviewEvidence(place, reviewBlob);

  if (socialReviewAgreeBusy) {
    vibeGapBullets.push(
      `Evidence: this draw uses the lively goal-cue pack (tags such as ${tagSample}), and reviews echo busy or wait-heavy language (${reviewSample}) — signals align, so the gap score stays low.`,
    );
  }

  if (hiddenGemHype && highReviewVolume) {
    vibeGapBullets.push(
      `Evidence: goal-cue text still uses discovery-style language (“${snippet(socialBlob, "hidden gem|underrated|secret")}”), while ${place.reviewCount.toLocaleString()} reviews imply the venue is already mainstream.`,
    );
    mismatchPoints += 22;
  }

  if (socialCalmPackActive && crowdedReality) {
    vibeGapBullets.push(
      `Evidence: the calm on-card goal-cue lines show study-, hush-, or no-wait cues (${tagSample}), but review snippets emphasize noise, crowding, or waits (${reviewSample}).`,
    );
    mismatchPoints += 62;
  }

  if (cheapSocial && expensiveReality) {
    vibeGapBullets.push(
      `Evidence: captions push budget-friendly value, while review text flags price or portion expectations (“${snippet(reviewBlob, "expensive|overpriced|price|portions")}”).`,
    );
    mismatchPoints += 30;
  }

  if (waitReality && effortlessAccessSocial) {
    vibeGapBullets.push(
      "Evidence: goal-cue text implies walk-in ease, while reviews still surface lines, pacing, or reservation friction.",
    );
    mismatchPoints += 20;
  } else if (waitReality && socialCalmPackActive) {
    vibeGapBullets.push(
      "Evidence: reviews mention waits or pacing alongside a low-key, “no rush” storyline in the calmer on-card goal cues.",
    );
    mismatchPoints += 12;
  }

  if (socialBusyPack && !crowdedReality) {
    vibeGapBullets.push(
      usesGoogleReviewSignals(place)
        ? `Evidence: goal-cue text reads energetic (${tagSample}), while the available Google review signals are comparatively tame on waits and noise — a partial, not total, mismatch.`
        : `Evidence: goal-cue text reads energetic (${tagSample}), while this review snapshot is comparatively tame on waits and noise — a partial, not total, mismatch.`,
    );
    mismatchPoints += 20;
  }

  const hadConflictMismatch = mismatchPoints > 0;

  if (!hadConflictMismatch && !socialReviewAgreeBusy) {
    vibeGapBullets.push(
      usesGoogleReviewSignals(place)
        ? "Evidence: visible tags and review themes line up in the available Google review signals — any remaining deltas look situational (timing, seating, or party size)."
        : "Evidence: on-card goal-cue tags and review themes line up in this snapshot — any remaining deltas look situational (timing, seating, or party size).",
    );
  }

  return {
    socialMode,
    hiddenGemHype,
    socialCalmPackActive,
    cheapSocial,
    effortlessAccessSocial,
    crowdedReality,
    expensiveReality,
    waitReality,
    highReviewVolume,
    socialReviewAgreeBusy,
    vibeGapBullets,
    mismatchPoints,
  };
}

function sampleVisibleVibeTags(posts: SocialPost[]): string {
  const tags = new Set<string>();
  posts.forEach((p) => p.vibeTags.forEach((t) => tags.add(t)));
  const list = [...tags].slice(0, 4);
  return list.length > 0 ? list.map((t) => `“${t}”`).join(", ") : "the on-card tags";
}

function sampleReviewEvidence(place: PlaceData, reviewBlob: string): string {
  const concern = dominantReviewConcern(place, reviewBlob);
  return concern ?? "review themes look mixed";
}

/** Short fragment for rationale copy. */
function snippet(blob: string, altPattern: string): string {
  const m = blob.match(new RegExp(`(${altPattern})`, "i"));
  return m?.[1] ? m[1].slice(0, 24) : "…";
}

function dominantReviewConcern(place: PlaceData, reviewBlob: string): string | null {
  const labels = place.reviewThemes.filter((t) => t.sentiment === "negative").map((t) => t.label.toLowerCase());
  if (labels.some((l) => /\bwait|service speed|reservation\b/.test(l)) || /\b(wait|line|queue|reservation|slow)\b/i.test(reviewBlob)) {
    return "wait times and reservation friction";
  }
  if (labels.some((l) => /\bnoise|crowd\b/.test(l)) || /\b(loud|noise|crowd|packed|busy)\b/i.test(reviewBlob)) {
    return "noise and crowding";
  }
  if (labels.some((l) => /\bvalue|price\b/.test(l)) || /\b(expensive|overpriced|price|not worth|value)\b/i.test(reviewBlob)) {
    return "price and value pressure";
  }
  if (labels.some((l) => /\blaptop|work\b/.test(l)) || /\b(laptop|wifi|wi-fi|outlet|study)\b/i.test(reviewBlob)) {
    return "laptop/work friendliness";
  }
  const first = place.reviewThemes.find((t) => t.sentiment === "negative")?.label;
  return first ? first.toLowerCase() : null;
}

function hasStrongRepeatedGoogleConflict(place: PlaceData, mismatch: MismatchSignals): boolean {
  if (!usesGoogleReviewSignals(place)) return false;
  const repeatedNegativeThemes = place.reviewThemes.filter((t) => t.sentiment === "negative" && t.strength >= 58).length;
  const clearConflictCount = Number(mismatch.crowdedReality) + Number(mismatch.expensiveReality) + Number(mismatch.waitReality);
  return repeatedNegativeThemes >= 2 && clearConflictCount >= 2;
}

function finalizeVibeGapScore(mismatch: MismatchSignals, divergence: number, place: PlaceData): number {
  if (mismatch.mismatchPoints > 0) {
    const raw = clamp(Math.round(mismatch.mismatchPoints + divergence * 0.35), 18, 100);
    if (hasStrongRepeatedGoogleConflict(place, mismatch)) {
      return clamp(raw, 18, 97);
    }
    return clamp(raw, 18, 85);
  }
  if (mismatch.socialReviewAgreeBusy) {
    return clamp(Math.round(10 + divergence * 0.4), 6, 28);
  }
  return clamp(Math.round(8 + divergence * 0.55), 4, GAP_LOW_MAX);
}

function verdictForVibeGap(vibeGapScore: number): string {
  if (vibeGapScore <= GAP_LOW_MAX) {
    return "On-card goal cues and review themes mostly line up in this snapshot.";
  }
  if (vibeGapScore <= GAP_MED_MAX) {
    return "Noticeable mismatch between goal-cue text cues and recurring review themes.";
  }
  return "High mismatch between general venue appeal and review-backed visit fit.";
}

/** Intent Fit bands for quick verdict copy (V2.3). */
const INTENT_HIGH_MIN = 60;
const INTENT_LOW_MAX = 47;

function repeatedReviewThemeCount(place: PlaceData): number {
  return place.reviewThemes.filter((t) => t.strength >= 58).length;
}

function buildDecisionConfidence(place: PlaceData, intent: DetectedIntent): DecisionSummary["confidence"] {
  const hasGoal = intent.kind !== "venue_lookup";
  const hasGooglePlace = place.dataSource === "google" && Boolean(place.isRealPlaceData);
  const hasGoogleReviews = usesGoogleReviewSignals(place);
  const repeatedThemes = repeatedReviewThemeCount(place);

  if (hasGooglePlace && hasGoogleReviews && repeatedThemes >= 2 && hasGoal) return "High";
  if (hasGooglePlace && hasGoogleReviews) return "Medium";
  return "Low";
}

function confidenceReason(place: PlaceData, confidence: DecisionSummary["confidence"]): string {
  if (confidence === "High") {
    return "Based on a matched Google place and repeated Google review themes.";
  }
  if (confidence === "Medium") {
    return PRODUCT_HONESTY_FULL;
  }
  if (place.dataSource === "google" && !usesGoogleReviewSignals(place)) {
    return "Place profile from Google; review theme depth is limited in this snapshot.";
  }
  return "Based on deterministic mock venue data, not a confirmed real place.";
}

function buildDecisionSummary(input: {
  score: VibeGapScore;
  intent: DetectedIntent;
  place: PlaceData;
}): DecisionSummary {
  const { score, intent, place } = input;
  const confidence = buildDecisionConfidence(place, intent);
  const hasGoal = intent.kind !== "venue_lookup";
  const goalHint = hasGoal ? `For “${intent.label.toLowerCase()}”, ` : "";
  const studyGoal = intent.kind === "study_work" || intent.kind === "quiet_calm";
  const budgetGoal = intent.kind === "budget_eats" || intent.kind === "budget_celebration";
  const lowWaitGoal = intent.kind === "low_wait";

  const majorRiskHigh =
    score.waitRiskScore >= 70 || score.priceRealityScore >= 70 || score.laptopFriendlyScore <= 28;

  let label: DecisionSummary["label"];
  let decisionLine: string;

  if (
    score.intentFitScore < 35 ||
    (studyGoal && score.laptopFriendlyScore < 35) ||
    (budgetGoal && score.priceRealityScore >= 70) ||
    (lowWaitGoal && score.waitRiskScore >= 72)
  ) {
    label = "SKIP";
    decisionLine = `${goalHint}review themes conflict with the plan based on available signals — not a strong pick for this goal.`;
  } else if (
    score.intentFitScore >= 70 &&
    score.vibeGapScore < 60 &&
    !majorRiskHigh &&
    confidence !== "Low"
  ) {
    label = "GO";
    decisionLine = `${goalHint}fit looks strong with no major review warnings in the current snapshot — worth choosing if the listed risk is acceptable.`;
  } else {
    label = "MAYBE";
    decisionLine = lowWaitGoal
      ? `${goalHint}possible fit, but reviews still suggest line or reservation friction — check timing.`
      : `${goalHint}possible fit, but reviews suggest waits, noise, or price risk — weigh the tradeoff.`;
  }

  if (lowWaitGoal && score.waitRiskScore >= 64 && label === "GO") {
    label = "MAYBE";
    decisionLine = `${goalHint}better if you can book ahead or arrive off-peak — queue themes still appear in reviews.`;
  }

  if (!hasGoal) {
    if (score.vibeGapScore >= 70) {
      label = "MAYBE";
      decisionLine =
        "Venue check without a parsed visit goal — venue details and review signals disagree enough that we would not over-commit without clearer intent.";
    } else if (label === "GO" && (score.vibeGapScore >= 45 || score.waitRiskScore >= 60 || score.priceRealityScore >= 60)) {
      label = "MAYBE";
      decisionLine = "Venue lookup looks workable, but risk signals suggest caution before you lock a plan.";
    }
  }

  if (
    label === "MAYBE" &&
    score.intentFitScore >= 70 &&
    score.vibeGapScore < 60 &&
    score.waitRiskScore < 65 &&
    confidence !== "Low"
  ) {
    label = "GO";
    decisionLine = `${goalHint}fit looks strong with no major review warnings in the current snapshot — best current read based on available signals.`;
  }

  const reason = `${decisionLine} ${confidenceReason(place, confidence)}`;
  return { label, confidence, reason };
}

type QuickVerdictInput = {
  place: PlaceData;
  score: VibeGapScore;
  detectedIntent: DetectedIntent;
  mismatch: MismatchSignals;
  reviewBlob: string;
  socialBlob: string;
  queryMode: QueryMode;
};

function frameQuickVerdictExplanation(explanation: string, mode: QueryMode, place: PlaceData): string {
  let framed: string;
  if (mode === "goal_search") {
    framed = `Goal-style lookup — ${explanation}`;
  } else if (mode === "specific_place") {
    framed = `Named venue — ${explanation}`;
  } else {
    framed = `Named venue and goal — ${explanation}`;
  }
  if (place.dataSource === "google" && place.isRealPlaceData) {
    framed = `${framed} Google confirms the venue details; scoring uses available Google review signals and rule-based weighting.`;
  }
  return framed;
}

function buildQuickVerdict(input: QuickVerdictInput): QuickVerdict {
  const { title, explanation } = decideQuickVerdictTitleAndExplanation(input);
  const evidenceBullets = buildIntentEvidenceBullets({
    kind: input.detectedIntent.kind,
    score: input.score,
    mismatch: input.mismatch,
    reviewBlob: input.reviewBlob,
    place: input.place,
    socialBlob: input.socialBlob,
  });
  return {
    title,
    explanation: frameQuickVerdictExplanation(explanation, input.queryMode, input.place),
    evidenceBullets,
  };
}

function decideQuickVerdictTitleAndExplanation(input: QuickVerdictInput): { title: string; explanation: string } {
  const { detectedIntent, score, mismatch, reviewBlob, place } = input;
  const gRev = usesGoogleReviewSignals(place);
  const i = score.intentFitScore;
  const v = score.vibeGapScore;
  const gapLow = v <= GAP_LOW_MAX;
  const highIntent = i >= INTENT_HIGH_MIN;
  const lowIntent = i <= INTENT_LOW_MAX;
  const midIntent = !highIntent && !lowIntent;
  const k = detectedIntent.kind;

  if (k === "venue_lookup") {
    if (gapLow) {
      return {
        title: "Venue check",
        explanation: gRev
          ? "No specific visit goal was detected. This report uses venue details, ratings, and available Google review themes. On-card goal cues and reviews point in a similar direction in this snapshot — add a goal like “low wait” or “birthday dinner” for a sharper read."
          : "No specific visit goal was detected. This report uses venue details, ratings, and available review themes. Add a goal like “quiet study”, “low wait”, or “birthday dinner” for a stronger recommendation.",
      };
    }
    return {
      title: "Venue check",
      explanation:
        "No specific visit goal was detected. This report uses venue details, rating quality, and available review themes. Add a goal like “no waiting time”, “quiet study”, or “birthday dinner” for a stronger recommendation.",
    };
  }

  if (highIntent && gapLow) {
    if (k === "party_nightlife") {
      return {
        title: "Good for a lively night out — but expect crowds and waits.",
        explanation:
          "goal-cue text and reviews both describe a high-energy room in this draw — treat lines, volume, and timing as normal parts of the night, not a surprise.",
      };
    }
    if (k === "budget_celebration") {
      return {
        title: "Good match — cues and reviews agree.",
        explanation: gRev
          ? "For a budget-friendly celebration, goal-cue text and review themes line up on value, waits, and crowding in the available Google review signals — still confirm menu math, tax, and tip so the bill matches the occasion."
          : "For a budget-friendly celebration, goal-cue text and review themes line up on value, waits, and crowding in this snapshot — still confirm menu math, tax, and tip so the bill matches the occasion.",
      };
    }
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Good match — cues and reviews agree.",
        explanation:
          "For quiet or focused time, goal-cue text and review signals point the same direction here — pick a calm window and double-check seating, but the big story looks consistent.",
      };
    }
    return {
      title: "Good match — goal-cue text and reviews agree.",
      explanation: gRev
        ? "For what you searched, goal-cue text and available Google review signals are not fighting each other — use Intent Fit as your green light, then handle the usual logistics (hours, reservations, seating)."
        : "For what you searched, goal-cue text and review cues are not fighting each other in this snapshot — use Intent Fit as your green light, then handle the usual logistics (hours, reservations, seating).",
    };
  }

  if (highIntent && !gapLow) {
    if (k === "party_nightlife") {
      return {
        title: "Good for a lively night out — but expect crowds and waits.",
        explanation:
          "The vibe still fits a night out, but goal-cue text may gloss over lines, packed dance floors, or pacing friction that reviewers repeat — leave extra time for entry or waits.",
      };
    }
    if (k === "budget_celebration") {
      return {
        title: "Good for your goal — but on-card cues may gloss over the rough edges.",
        explanation:
          "A celebration on a budget can still work, yet upbeat on-card cues may play down tabs, waits, or a loud room — align on price, timing, and how “special” the night needs to feel before you invite everyone.",
      };
    }
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Possible for your goal — verify the calm story.",
        explanation:
          "Intent Fit looks decent, but goal-cue text and reviews are not perfectly aligned on noise or crowding — skim recent comments for loud or crowded stretches before you book a long study block.",
      };
    }
    return {
      title: "Good for your goal — but signals conflict.",
      explanation:
        "The place may still suit what you want, yet goal-cue text and reviews disagree enough that surprises are likely — anchor on review themes for waits, noise, and price.",
    };
  }

  if (lowIntent && gapLow) {
    const reviewBusy = /\b(loud|noise|crowd|packed|busy|wait|line)\b/i.test(reviewBlob);
    if ((k === "study_work" || k === "quiet_calm") && mismatch.socialMode === "lively" && reviewBusy) {
      return {
        title: "Skip it for studying.",
        explanation:
          "goal-cue text and reviews both point to a busy, high-energy place. The issue is not a cue mismatch — it is poor fit for quiet work.",
      };
    }
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Skip it for your goal — goal-cue text and reviews agree.",
        explanation:
          "Signals line up on noise, turnover, or seating that clashes with focus or calm — the honest read is a miss for what you typed.",
      };
    }
    if (k === "party_nightlife") {
      return {
        title: "Skip it for a party night — signals agree.",
        explanation: gRev
          ? "goal-cue text and available Google review signals both describe a room that does not deliver the nightlife energy you asked for — pick a different spot rather than hoping it transforms at 10 p.m."
          : "goal-cue text and reviews both describe a room that does not deliver the nightlife energy you asked for in this snapshot — pick a different spot rather than hoping it transforms at 10 p.m.",
      };
    }
    if (k === "budget_celebration") {
      return {
        title: "Skip it for a budget celebration.",
        explanation:
          "Goal-cue text and reviews both imply price pressure, waits, or crowding that fights a tight, special-occasion plan — agreement here means a clean “no,” not a mystery.",
      };
    }
    return {
      title: "Skip it for your goal — goal-cue text and reviews agree.",
      explanation:
        "The signals tell the same story, and that story is a poor match for what you searched — believe the agreement and pick elsewhere.",
    };
  }

  if (lowIntent && !gapLow) {
    if (k === "budget_celebration") {
      return {
        title: "Risky for a budget celebration.",
        explanation:
          "goal-cue text reads budget-friendly, but reviews suggest price pressure, waits, or crowding — weak fit for a celebration on a cap.",
      };
    }
    return {
      title: "Risky choice — weak fit for your goal.",
      explanation:
        "Intent Fit is weak while goal-cue text and review themes disagree — anchor on waits, noise, and price in recent reviews before you commit.",
    };
  }

  if (midIntent && gapLow) {
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Uncertain for studying — check recent noise and seating reviews.",
        explanation:
          "Intent Fit sits in the gray zone while goal-cue text and reviews mostly agree — that often means seat-by-seat luck. Skim very fresh notes on volume, turnover, outlets, and table size before you bank on a long session.",
      };
    }
    return {
      title: "Moderate fit — signals mostly agree.",
      explanation:
        "Intent Fit sits in the middle: not a slam dunk for your goal, but goal-cue text and reviews are not contradicting each other here — a careful visit can still work if you read fresh notes.",
    };
  }

  return {
    title: "Uncertain fit — mixed goal match and noisy signals.",
    explanation:
      "Intent Fit is middling while goal-cue text and reviews pull in different directions — treat this as a yellow light: anchor on recent reviews and keep a backup plan.",
  };
}

function buildIntentEvidenceBullets(input: {
  kind: UserIntentKind;
  score: VibeGapScore;
  mismatch: MismatchSignals;
  reviewBlob: string;
  place: PlaceData;
  socialBlob: string;
}): readonly [string, string, string] {
  const { kind, score, mismatch, reviewBlob, place, socialBlob } = input;
  const b1 = selectReviewLineForEvidence(place, reviewBlob, kind);
  const b2 = framingSignalLineForEvidence(kind, mismatch, socialBlob);
  const b3 = thirdEvidenceLine(score, kind, place);
  return [b1, b2, b3];
}

function selectReviewLineForEvidence(place: PlaceData, reviewBlob: string, kind: UserIntentKind): string {
  const concern = dominantReviewConcern(place, reviewBlob);
  const gRev = usesGoogleReviewSignals(place);
  if (kind === "party_nightlife") {
    if (/\b(wait|line|crowd|packed|loud|music|noise|dj)\b/i.test(reviewBlob)) {
      return gRev
        ? "Google reviews repeatedly mention lines, noise, or crowding, so timing and volume may be risky."
        : "Review signals in this snapshot repeatedly mention lines, noise, or crowding, so timing and volume may be risky.";
    }
  }
  if (kind === "budget_celebration" || kind === "budget_eats") {
    if (/\b(expensive|overpriced|wait|line|portion)\b/i.test(reviewBlob)) {
      return gRev
        ? "Google review themes flag price or line pressure, so budget predictability may be weaker than upbeat goal-cue text suggests."
        : "Review signals in this snapshot flag price or line pressure, so budget predictability may be weaker than upbeat goal-cue text suggests.";
    }
  }
  if (kind === "study_work" || kind === "quiet_calm") {
    if (/\b(loud|noise|wait|line|crowd|packed|busy|seating|small)\b/i.test(reviewBlob)) {
      return gRev
        ? "Google reviews mention noise, seating pressure, or waits, which can clash with focused work."
        : "Review signals in this snapshot mention noise, seating pressure, or waits, which can clash with focused work.";
    }
  }
  if (kind === "low_wait") {
    if (/\b(wait|line|queue|reservation|packed|crowd|busy|slow seating)\b/i.test(reviewBlob)) {
      return gRev
        ? "Google review signals mention line or reservation friction, which is risky for a no-wait visit."
        : "Review signals in this snapshot mention line or reservation friction, which is risky for a no-wait visit.";
    }
    return gRev
      ? "Available Google review signals suggest a more manageable queue profile off-peak."
      : "In this result set, queue signals look more manageable off-peak.";
  }
  if (concern) {
    return `Review themes repeatedly point to ${concern}.`;
  }
  return pickReviewEvidenceLine(place, reviewBlob);
}

function framingSignalLineForEvidence(kind: UserIntentKind, mismatch: MismatchSignals, socialBlob: string): string {
  if (kind === "venue_lookup") {
    return "Without a parsed visit goal, on-card goal cues are informational only — anchor on Google ratings and recurring review themes.";
  }
  if (kind === "low_wait") {
    if (/\b(wait|line|queue|packed|crowd|reservation)\b/i.test(socialBlob)) {
      return "goal-cue text still shows peak-time crowd cues, so no-wait expectations may be fragile.";
    }
    return "goal-cue text implies easier access, but review-side queue signals should drive the decision.";
  }
  if (kind === "party_nightlife") {
    if (mismatch.socialMode === "lively") {
      return "goal-cue text skews DJ-forward and high-energy, with packed-room cues in this vignette.";
    }
    return "goal-cue text reads softer than peak club hours — still compare with reviews on bass, lines, and fill times.";
  }
  if (kind === "budget_celebration" || kind === "budget_eats") {
    if (/\b(cheap|budget|deal|steal|value)\b/i.test(socialBlob)) {
      return "goal-cue text pushes easy value and shareable moments — weigh that against recurring review-side price concerns.";
    }
    return "goal-cue text still skews appetizing and fun — pair that with a quick scan for wait and value themes in reviews.";
  }
  return mismatch.socialMode === "lively"
    ? "goal-cue text reads loud, line-prone, and high-energy — not ideal for deep-focus work."
    : "goal-cue text leans calmer or easier access — compare that storyline with review themes on noise and waits.";
}

function thirdEvidenceLine(score: VibeGapScore, kind: UserIntentKind, place: PlaceData): string {
  const gRev = usesGoogleReviewSignals(place);
  const mentionLaptop = kind === "study_work" || kind === "quiet_calm";

  if (mentionLaptop) {
    if (score.laptopFriendlyScore < 38) {
      return "Laptop- and deep-work signals look very weak — expect noise, turnover, or tight seating instead of a long focus block.";
    }
    if (score.laptopFriendlyScore < 55) {
      return "Outlets and long-session comfort look only middling — fine for a quick task, not a library-style stay.";
    }
    return "Some laptop-friendly cues exist — still filter reviews for noise spikes and seating at rush hour.";
  }

  if (kind === "party_nightlife") {
    if (score.waitRiskScore >= 50) {
      return "Lines and door pacing show up often — pick off-peak arrival or extra time if you hate standing around.";
    }
    if (score.vibeGapScore > GAP_LOW_MAX) {
      return "Some reviewers say crowds, bass, or waits land heavier than short clips imply — skim nights before you rally the group.";
    }
    return gRev
      ? "Music, crowd energy, and weekend pacing in reviews line up with a nightlife-forward night in the available Google review signals."
      : "Music, crowd energy, and weekend pacing in reviews line up with a nightlife-forward night in this result set.";
  }

  if (kind === "low_wait") {
    if (score.waitRiskScore >= 68) {
      return "Wait-risk is high in current signals — likely MAYBE or SKIP unless your timing is flexible.";
    }
    if (score.waitRiskScore >= 52) {
      return "Queue risk is moderate; better if you can book ahead or arrive off-peak.";
    }
    return "Queue and reservation pressure look relatively controlled in this snapshot.";
  }

  if (kind === "budget_celebration" || kind === "budget_eats") {
    if (score.priceRealityScore >= 50) {
      return "Price mismatch risk looks meaningful — upbeat on-card value cues may not match how the check lands in reviews.";
    }
    if (score.waitRiskScore >= 50) {
      return kind === "budget_celebration"
        ? "Waits or pacing show up often enough to pad the schedule — especially on weekends."
        : "Waits or pacing show up often enough to pad the schedule for your meal — especially on weekends.";
    }
    return "Price and wait themes look moderate in this slice — still confirm reservations, tax, and tip expectations with the menu.";
  }

  if (kind === "date_night") {
    return score.waitRiskScore >= 55
      ? "Waits and pacing could interrupt an intimate table flow — worth securing a reservation window that fits the night."
      : "Review cues on intimacy versus noise look mixed — skim for table spacing and volume before you dress it up.";
  }

  if (kind === "family") {
    return score.vibeGapScore > GAP_LOW_MAX
      ? "Family cues in reviews and goal-cue text are not fully aligned — double-check kid policies, volume, and high-chair availability."
      : "Goal-cue text and reviews mostly agree on the vibe family-wise — still confirm booster seats or stroller space if you need them.";
  }

  if (kind === "luxury") {
    return score.priceRealityScore >= 50
      ? "Splurge expectations bump into value complaints in reviews — calibrate before you commit a special-occasion budget."
      : gRev
        ? "Upscale signals look steadier in the available Google review signals — still validate wine, tasting, or dress code details outside VibeGap."
        : "Upscale signals look steadier in this result set — still validate wine, tasting, or dress code details outside VibeGap.";
  }

  if (kind === "venue_lookup") {
    return gRev
      ? "Use rating, price level, and recurring Google review themes as the main read — add a visit goal to tighten intent fit."
      : "Use rating, price level, and recurring review themes as the main read — add a visit goal to tighten intent fit.";
  }

  return score.vibeGapScore > GAP_LOW_MAX
    ? "With no parsed goal, lean on the mismatch between goal-cue text and what reviewers keep repeating."
    : "Without a parsed goal, goal-cue text and reviews line up enough that there is no big mystery to solve here.";
}

function pickReviewEvidenceLine(place: PlaceData, reviewBlob: string): string {
  const gRev = usesGoogleReviewSignals(place);
  const concern = dominantReviewConcern(place, reviewBlob);
  if (concern) {
    return gRev
      ? `Google review themes repeatedly mention ${concern}.`
      : `In this result set, review themes repeatedly mention ${concern}.`;
  }
  const theme = place.reviewThemes.find((t) => t.sentiment === "negative")?.label;
  if (theme) {
    const t = theme.toLowerCase();
    return gRev
      ? `Review themes call out ${t} more than once in the available Google review signals.`
      : `Review themes call out ${t} more than once in this result set.`;
  }
  if (/\b(loud|noise|wait|line|crowd)\b/i.test(reviewBlob)) {
    return `Review snippets repeat words like “${snippet(reviewBlob, "loud|noise|wait|line|crowd|busy")}” — worth noting before you go.`;
  }
  return gRev
    ? "Available Google review signals look fairly steady — no single complaint dominates the snapshot."
    : "Reviews in this result set look fairly steady — no single complaint dominates the snapshot.";
}

// ---------------------------------------------------------------------------
// Intent Fit: user goal vs. modeled reality
// ---------------------------------------------------------------------------

type IntentFitResult = { score: number; verdict: string; bullets: string[] };

/**
 * Scores how well the venue matches the user’s inferred goal using reviews + goal-cue text as “what you’ll get”.
 * High score = good fit; low score = your goal is poorly served. Independent of the signal-gap score.
 */
function computeIntentFitScore(
  intent: DetectedIntent,
  socialBlob: string,
  reviewBlob: string,
  place: PlaceData,
  socialMode: "calm" | "lively",
  laptopFriendlyScore: number,
): IntentFitResult {
  const gRev = usesGoogleReviewSignals(place);
  const socialBusy =
    socialMode === "lively" ||
    /\b(loud|noise|crowd|packed|busy|wait|line|chaos|party|dj)\b/i.test(socialBlob);
  const reviewBusy = /\b(loud|noise|crowd|packed|busy|wait|line)\b/i.test(reviewBlob);

  const busySignal = socialBusy || reviewBusy;

  const calmSignal =
    /\b(quiet|calm|peaceful|intimate|hushed|cozy|study|laptop)\b/i.test(reviewBlob) ||
    (socialMode === "calm" && /\b(quiet|calm|study|laptop|hushed)\b/i.test(socialBlob));

  if (intent.kind === "venue_lookup") {
    return {
      score: 55,
      verdict: "Neutral — we did not parse a specific visit goal from your search.",
      bullets: [
        "Intent Fit stays near the midpoint for venue-style queries (no study, budget, party, or similar keywords).",
        `The report still weighs goal-cue text against reviews for “${place.name}” — add goal words (e.g. “quiet study”, “cheap eats”) to score intent more sharply.`,
      ],
    };
  }

  if (intent.kind === "low_wait") {
    const reviewWaitHeavy =
      /\b(wait|line|queue|reservation|packed|crowd|busy|slow seating|slow service)\b/i.test(reviewBlob);
    const reviewEasyAccess =
      /\b(no wait|short wait|quick seating|easy reservation|walk-?in|off-peak)\b/i.test(reviewBlob);
    const socialWaitHeavy = /\b(wait|line|queue|reservation|packed|crowd|busy)\b/i.test(socialBlob);

    let scoreW = 70;
    if (reviewWaitHeavy) scoreW -= 36;
    if (socialWaitHeavy) scoreW -= 10;
    if (reviewEasyAccess) scoreW += 12;
    if (place.reviewCount > 1200 && reviewWaitHeavy) scoreW -= 8;
    scoreW = clamp(scoreW, 10, 90);

    return {
      score: scoreW,
      verdict:
        scoreW < 38
          ? "Risky for a no-wait visit."
          : scoreW < 62
            ? "Possible for a low-wait visit, but timing risk is visible."
            : "Reasonable fit for a low-wait visit if you time it well.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 5).join(", ")}).`,
        reviewWaitHeavy
          ? "Review signals repeatedly mention lines, reservation friction, crowding, or slow seating."
          : "Review signals show fewer hard queue warnings in this snapshot.",
        reviewEasyAccess
          ? "Some reviews mention walk-ins, quick seating, or easier off-peak access."
          : "Better if you can book ahead or arrive off-peak.",
      ],
    };
  }

  if (intent.kind === "study_work" || intent.kind === "quiet_calm") {
    const agree = socialBusy && reviewBusy;

    if (busySignal && !calmSignal) {
      let scoreS = agree ? 24 : 20;
      if (laptopFriendlyScore < 40) scoreS -= 8;
      if (laptopFriendlyScore < 48) scoreS -= 4;
      scoreS = clamp(scoreS, 10, 34);
      return {
        score: scoreS,
        verdict: "Poor fit for a quiet or focused visit.",
        bullets: agree
          ? [
              `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 4).join(", ") || "query cues"}).`,
              `The livelier on-card goal cues and review snippets both skew energetic or wait-heavy — weak match for your goal. Laptop-friendly score (${laptopFriendlyScore}/100) backs that read.`,
              "The signal-gap score stays low when goal-cue text and reviews agree; Intent Fit is the main red flag for study-style plans.",
            ]
          : [
              `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 4).join(", ") || "query cues"}).`,
              "Reviews emphasize noise, crowding, waits, or turnover — a rough match for quiet work even when goal-cue text looks softer.",
            ],
      };
    }
    if (!busySignal && calmSignal) {
      return {
        score: 82,
        verdict: "Strong fit for a calmer or work-friendly visit based on available cues.",
        bullets: [
          `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 4).join(", ")}).`,
          "Review excerpts and goal-cue text both lean quieter or more controlled — aligned with your stated goal.",
        ],
      };
    }
    const mixedScore =
      laptopFriendlyScore < 40 ? 42 : laptopFriendlyScore < 50 ? 50 : laptopFriendlyScore < 58 ? 55 : 58;
    return {
      score: mixedScore,
      verdict:
        laptopFriendlyScore < 42
          ? "Uncertain fit — laptop and noise signals are mixed; skim fresh reviews before a long study block."
          : "Mixed fit — signals are ambiguous for quiet or study use.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()}.`,
        laptopFriendlyScore < 48
          ? `Laptop-friendly score (${laptopFriendlyScore}/100) looks weak for long sessions — pair that with review notes on noise, seating, and turnover.`
          : gRev
            ? "Available Google review themes include both energetic and calmer cues — treat this as a reminder to read the latest reviews before planning deep work."
            : "Review themes include both energetic and calmer cues — treat this as a reminder to read the latest reviews before planning deep work.",
        gRev
          ? "If you need silence, favor off-peak windows and seats away from the service path — goal-cue text is not a live crowd forecast."
          : "If you need silence, favor off-peak windows and seats away from the service path when reviews look mixed.",
      ],
    };
  }

  if (intent.kind === "party_nightlife") {
    const energySocial =
      /\b(party|dj|crowd|packed|night|shots|dancing|loud|music|chaos|energy|club|vibe|scene)\b/i.test(socialBlob);
    const energyReviews =
      /\b(loud|music|noise|crowd|packed|busy|wait|line|night|party|dj|weekend)\b/i.test(reviewBlob);
    const nightlifeRoom = socialMode === "lively";
    const feelsLikeNightOut = energySocial || energyReviews || nightlifeRoom;

    if (feelsLikeNightOut) {
      let scoreN = 80;
      if (nightlifeRoom) scoreN += 4;
      if (/\b(wait|line|reservation)\b/i.test(reviewBlob)) scoreN -= 5;
      if (/\b(wait|line)\b/i.test(socialBlob)) scoreN -= 3;
      if (!energySocial && socialMode === "calm") scoreN -= 16;
      if (!energyReviews && !energySocial && socialMode === "lively") scoreN -= 10;
      scoreN = clamp(scoreN, 56, 92);

      const strong = scoreN >= 72;
      return {
        score: scoreN,
        verdict: strong
          ? "Good for a lively night out — crowds and waits can still happen."
          : "Good energy for going out — double-check music, door time, and cover in recent reviews.",
        bullets: [
          `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
          strong
            ? "Review signals skew loud, crowd-forward, and weekend-heavy — that usually supports a party night; lines and packed rooms read as normal friction, not a goal misfit."
            : "The on-card goal cues read upbeat but not a guaranteed club night — skim for DJ calendars vs. slow nights before you dress up.",
          nightlifeRoom
            ? "The livelier on-card goal cues line up with high-tempo expectations — still pick an arrival window that tolerates a wait."
            : "Goal-cue tone is mixed — pair it with review notes on crowd, music, and pacing.",
        ],
      };
    }

    return {
      score: 54,
      verdict: "Soft signals for a big night out — confirm the room before you commit.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()}.`,
        "Goal cues and reviews are not consistently loud-nightlife here — check hours, DJs, and cover before you rally the group.",
      ],
    };
  }

  if (intent.kind === "date_night") {
    const intimate = /\b(intimate|romantic|candle|quiet table|date)\b/i.test(socialBlob + reviewBlob);
    const chaotic = busySignal && !intimate;
    return {
      score: chaotic ? 38 : intimate ? 78 : 58,
      verdict: chaotic
        ? "Shaky fit for an intimate date — noise and pacing show up often."
        : gRev
          ? "Reasonable fit for date night in the available Google review signals."
          : "Reasonable fit for date night in this snapshot.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        chaotic
          ? "Reviews skew loud or busy without strong ‘intimate table’ language — a risky pick for a quiet anniversary unless you book off-peak."
          : gRev
            ? "Goal-cue text and reviews leave room for a polished table experience — still confirm reservations and seating in fresh Google reviews."
            : "Goal cues and reviews leave room for a polished table experience — still confirm reservations and seating from current listings.",
      ],
    };
  }

  if (intent.kind === "budget_celebration") {
    const badValue = expensiveRealityFromBlob(reviewBlob, place);
    const waitHeavy = /\b(wait|line|reservation|packed|slow)\b/i.test(reviewBlob);
    const festive = /\b(festive|fun|celebrate|party|group|toast)\b/i.test(`${reviewBlob} ${socialBlob}`);
    let scoreN = 70;
    if (badValue) scoreN -= 32;
    if (waitHeavy) scoreN -= 14;
    if (busySignal && !festive) scoreN -= 12;
    if (socialMode === "lively" && reviewBusy) scoreN -= 8;
    scoreN = clamp(scoreN, 14, 88);

    const verdict =
      scoreN < 42
        ? "Weak fit for a budget celebration — price, waits, or crowding fight the plan."
        : scoreN >= 66
          ? "Reasonable fit for a casual celebration on a budget."
          : "Mixed fit — workable only if the group is flexible on spend, timing, and noise.";

    const bullets: string[] = [
      `Matched goal: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 5).join(", ") || "query cues"}).`,
      badValue
        ? "Review language flags price pressure, smaller portions, or “not worth it” vibes — risky when the bill has to feel celebration-ready."
        : gRev
          ? "Review themes are not screaming value traps in the available Google review signals — still confirm menu pricing before you gather everyone."
          : "Review themes are not screaming value traps in this snapshot — still confirm menu pricing before you gather everyone.",
      waitHeavy || busySignal
        ? "Waits, reservations, or a loud room show up often — tough for a timed toast or a tight schedule."
        : "Pacing and crowding cues look moderate — still pad your schedule if you are hosting.",
    ];

    return { score: scoreN, verdict, bullets };
  }

  if (intent.kind === "budget_eats") {
    const badValue = expensiveRealityFromBlob(reviewBlob, place);
    return {
      score: badValue ? 32 : 74,
      verdict: badValue ? "Weak fit for a strict budget." : "Decent fit for value-seeking plans.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        badValue
          ? "Review snippets reference price pressure or smaller portions — misaligned with a tight budget goal."
          : gRev
            ? "Review themes do not overwhelmingly contradict a budget-minded visit in the available Google review signals."
            : "Review themes do not overwhelmingly contradict a budget-minded visit in this result set.",
      ],
    };
  }

  if (intent.kind === "luxury") {
    const luxSignals =
      place.priceLevel >= 3 && place.averageRating >= 3.9 && /\b(wine|sommelier|tasting|chef)\b/i.test(reviewBlob);
    return {
      score: luxSignals ? 80 : 50,
      verdict: luxSignals ? "Good fit for an upscale occasion." : "Mixed signals for a luxury expectation.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        luxSignals
          ? "Higher price band and positive food or service themes support a splurge-style visit in this snapshot."
          : "Available signals do not clearly confirm a white-tablecloth experience — validate menu and dress code elsewhere.",
      ],
    };
  }

  if (intent.kind === "family") {
    const hostile =
      /\b(loud|bar|shots|nightclub|21\+|adults only)\b/i.test(reviewBlob) ||
      /\b(loud|bar|shots|nightclub)\b/i.test(socialBlob);
    return {
      score: hostile ? 30 : 68,
      verdict: hostile ? "Risky for a family-first outing in this read." : "Acceptable family fit in current themes.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        hostile
          ? "Language in reviews or goal-cue text leans adult-night-out — double-check kid policies before booking."
          : "No strong ‘adults-only’ red flags in the available text snapshot — still verify high chairs and noise with the venue.",
      ],
    };
  }

  return {
    score: 55,
    verdict: "Neutral intent scoring fallback.",
    bullets: ["Unable to specialize this intent in the built-in rules — treat Intent Fit as a rough guide only."],
  };
}

function expensiveRealityFromBlob(reviewBlob: string, place: PlaceData): boolean {
  return /\b(expensive|overpriced|price|small portions|not worth)\b/i.test(reviewBlob) || place.priceLevel >= 3;
}

// ---------------------------------------------------------------------------
// Auxiliary scores (context, not “VibeGap” itself)
// ---------------------------------------------------------------------------

type AuxiliaryScores = {
  touristDensityScore: number;
  waitRiskScore: number;
  laptopFriendlyScore: number;
  priceRealityScore: number;
};

function computeAuxiliaryScores(
  place: PlaceData,
  reviewBlob: string,
  socialBlob: string,
  mismatch: MismatchSignals,
): AuxiliaryScores {
  const addressLower = place.address.toLowerCase();
  const resortOrHotelZone =
    /\b(hotel zone|coastal|km \d+|boulevard|beach|quintana roo|riviera)\b/i.test(addressLower);
  const metroTouristCore =
    /\b(soho|shibuya|shoreditch|design district|downtown|broadway)\b/i.test(addressLower);

  const touristDensityScore = clamp(
    (mismatch.highReviewVolume ? 36 : 16) +
      (resortOrHotelZone ? 18 : 0) +
      (metroTouristCore ? 12 : 0) +
      (mismatch.crowdedReality ? 16 : 0),
    0,
    100,
  );

  const socialWaitOrCrowd =
    /\b(wait|waits|line|lines|reservation|reservations|packed|crowd|crowded|slow)\b/i.test(socialBlob);
  const reviewWaitMentions =
    (reviewBlob.match(/\b(wait|waits|line|lines|queue|queued|queued up|slow service|slow|reservation)\b/gi) ?? [])
      .length;
  const reviewPriceMentions =
    (reviewBlob.match(/\b(expensive|overpriced|pricey|price|not worth|value|cost|bill|portion)\b/gi) ?? []).length;
  const reviewLaptopPositiveMentions =
    (reviewBlob.match(/\b(wifi|wi-fi|outlet|outlets|study|work|laptop|quiet)\b/gi) ?? []).length;
  const reviewLaptopNegativeMentions =
    (reviewBlob.match(/\b(loud|noise|noisy|crowd|crowded|packed|chaos|turnover|small tables)\b/gi) ?? []).length;

  const waitRiskScore = clamp(
    (mismatch.waitReality ? 38 : 12) +
      (socialWaitOrCrowd ? 18 : 0) +
      (mismatch.crowdedReality ? 20 : 0) +
      Math.min(reviewWaitMentions * 4, 24) +
      (place.reviewCount > 1500 ? 10 : 0),
    0,
    100,
  );

  const laptopPositiveSignals =
    /\b(laptop|wifi|wi-fi|outlet|outlets|spacious|work-friendly|study-friendly)\b/i.test(reviewBlob) ||
    (mismatch.socialCalmPackActive && /\b(laptop|wifi|outlet|study)\b/i.test(socialBlob));

  const laptopNegativeSignals =
    /\b(loud|party|dj|crowd|packed|turnover|small tables|dinner rush|no seating)\b/i.test(reviewBlob) ||
    mismatch.socialMode === "lively" ||
    /\b(loud|party|dj|crowd|packed|chaos)\b/i.test(socialBlob);

  let laptopFriendlyScore = 46;
  if (laptopPositiveSignals && !laptopNegativeSignals) laptopFriendlyScore += 34;
  if (laptopNegativeSignals) laptopFriendlyScore -= 42;
  laptopFriendlyScore += Math.min(reviewLaptopPositiveMentions * 4, 20);
  laptopFriendlyScore -= Math.min(reviewLaptopNegativeMentions * 5, 28);
  if (mismatch.socialCalmPackActive && mismatch.crowdedReality) laptopFriendlyScore -= 12;

  const priceMismatchRisk = clamp(
    (mismatch.cheapSocial && mismatch.expensiveReality ? 58 : 14) +
      Math.min(reviewPriceMentions * 4, 24) +
      (place.priceLevel >= 4 ? 14 : 0),
    0,
    100,
  );

  return {
    touristDensityScore,
    waitRiskScore,
    laptopFriendlyScore: clamp(laptopFriendlyScore, 0, 100),
    priceRealityScore: priceMismatchRisk,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function averageHypeIndex(posts: SocialPost[]): number {
  return Math.round(
    posts.reduce((acc, p) => acc + p.hypeScore, 0) / Math.max(posts.length, 1),
  );
}

function buildReviewBlob(place: PlaceData): string {
  return [
    ...place.complaints,
    ...place.positives,
    place.recentReviewSummary,
    ...place.reviewThemes.map((t) => t.label),
  ]
    .join(" ")
    .toLowerCase();
}

function joinSocialText(posts: SocialPost[]): string {
  return posts
    .map((p) => [p.caption, p.hashtags.join(" "), p.vibeTags.join(" ")].join(" "))
    .join(" ");
}

function computeRealityIndex(
  place: PlaceData,
  reviewBlob: string,
  crowdedReality: boolean,
  expensiveReality: boolean,
): number {
  return clamp(
    52 +
      (crowdedReality ? 10 : -6) +
      (expensiveReality ? 8 : -4) +
      (place.averageRating < 3.8 ? 8 : -4),
    0,
    100,
  );
}

function computeHypeRealityDivergence(hypeIndex: number, realityIndex: number): number {
  return Math.min(14, Math.round(Math.abs(hypeIndex - realityIndex) * 0.22));
}

function buildRealitySummary(place: PlaceData): string {
  const topNeg = place.reviewThemes.filter((t) => t.sentiment === "negative").slice(0, 2);
  const topPos = place.reviewThemes.filter((t) => t.sentiment === "positive").slice(0, 2);
  const negLine =
    topNeg.length > 0
      ? `Themes skew critical on ${topNeg.map((t) => t.label.toLowerCase()).join(" and ")}.`
      : "";
  const posLine =
    topPos.length > 0
      ? `Reviewers still call out ${topPos.map((t) => t.label.toLowerCase()).join(" and ")} as strengths.`
      : "";
  return `${place.recentReviewSummary} ${negLine} ${posLine}`.trim();
}

function summarizeSocialHype(posts: SocialPost[], mode: "calm" | "lively"): string {
  const tags = new Set<string>();
  posts.forEach((p) => p.vibeTags.forEach((t) => tags.add(t)));
  const tagLine = [...tags].slice(0, 6).join(", ") || "short on-card goal cues";
  const pack =
    mode === "lively"
      ? "livelier on-card goal cues (energy, crowds, or late-night phrasing)"
      : "calmer on-card goal cues (quiet table, study, or easier-access phrasing)";
  return `VibeGap uses ${pack} as deterministic goal-cue text alongside Google review themes where available. Theme tags include: ${tagLine}. The signal-gap score contrasts those cues with review text; Intent Fit weighs both against the goal parsed from your search.`;
}

function deriveTags(
  place: PlaceData,
  score: VibeGapScore,
  intent: DetectedIntent,
): { bestFor: string[]; avoidIf: string[] } {
  if (intent.kind === "budget_celebration") {
    return {
      bestFor: [
        "Flexible casual plans with a little room if the tab creeps",
        "Groups that can tolerate a short wait or an off-peak table",
        "Hosts who check the menu and pricing online before inviting everyone",
      ],
      avoidIf: [
        "Strict per-person budgets with zero wiggle room",
        "No-reservation milestone celebrations at peak hour",
        "Quiet, intimate special occasions when reviews mention noise or lines",
      ],
    };
  }

  if (intent.kind === "study_work" || intent.kind === "quiet_calm") {
    const bestFor: string[] = [];
    const avoidIf: string[] = [];
    if (score.intentFitScore >= 58) {
      bestFor.push("Short focus blocks after you confirm a calmer window in fresh reviews");
      bestFor.push("Visitors who pack headphones and do not need all-day library silence");
    } else {
      bestFor.push("Quick stops between errands when you are not banking on deep quiet");
    }
    if (place.averageRating >= 4.0) {
      bestFor.push("A relaxed bite once real work is done somewhere quieter");
    }

    avoidIf.push("Library-quiet concentration without checking noise and seating first");
    if (score.waitRiskScore >= 55) {
      avoidIf.push("Tight schedules with no buffer for lines or slow pacing");
    }
    if (score.laptopFriendlyScore < 45) {
      avoidIf.push("All-day laptop sessions when reviews flag turnover or tight tables");
    }
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  if (intent.kind === "low_wait") {
    const bestFor: string[] = [
      "Visits where you can book ahead or choose off-peak arrival windows",
      "Flexible plans that can shift 15-30 minutes if the first wave is crowded",
    ];
    if (score.waitRiskScore < 50) bestFor.push("Quick meals when timing reliability matters");
    const avoidIf: string[] = [
      "Rigid schedules with zero buffer for line or seating delays",
      "Walk-in plans during peak dinner rush without a backup",
    ];
    if (score.waitRiskScore >= 65) avoidIf.push("No-wait expectations when reviews repeatedly mention line friction");
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  if (intent.kind === "party_nightlife") {
    const bestFor: string[] = [
      "Groups chasing loud music, crowds, and a late-night energy match",
      "Birthdays or pre-games where a short wait fits the plan",
    ];
    if (place.averageRating >= 4.0) {
      bestFor.push("Nights when the scene matters as much as what is in the glass");
    }
    const avoidIf: string[] = [
      "Early-bed nights with zero patience for line drama",
      "Quiet catch-ups where you need a low-noise table",
    ];
    if (score.waitRiskScore >= 58) {
      avoidIf.push("Fixed showtimes or arrivals when the room may run one-in, one-out and lines are likely");
    }
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  if (intent.kind === "date_night") {
    const bestFor: string[] = ["Couples who book ahead and pick a quieter slot when reviews allow"];
    if (place.averageRating >= 4.0) bestFor.push("Food-forward dates with time to enjoy pacing between courses");
    if (score.waitRiskScore < 52) bestFor.push("Low-stress nights when you are not racing to a show after");
    const avoidIf: string[] = ["Surprise walk-ins on loud, packed nights without a reservation backup"];
    if (score.waitRiskScore >= 55) avoidIf.push("Tight timelines where a line would ruin the evening flow");
    if (score.vibeGapScore > GAP_LOW_MAX) avoidIf.push("Trusting polished on-card cues alone when reviews mention noise or crowding");
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  if (intent.kind === "family") {
    const bestFor: string[] = ["Early dinners when kids have energy and the kitchen is less slammed"];
    if (place.averageRating >= 4.0) bestFor.push("Families who confirmed high chairs or kid-friendly pacing with the venue");
    bestFor.push("Outings where a little background buzz is fine for your crew");
    const avoidIf: string[] = ["Visits without checking noise, bar-forward language, or age policies in reviews"];
    if (score.waitRiskScore >= 55) avoidIf.push("Hangry toddlers when lines or slow pacing are likely");
    avoidIf.push("Assuming stroller space or booster seats without a quick venue check");
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  if (intent.kind === "budget_eats") {
    const bestFor: string[] = [
      "Weekday lunches when lines are shorter and tabs stay predictable",
      "Friends who split shared plates and do not mind a lively room",
    ];
    if (place.priceLevel <= 2) bestFor.push("Casual plans where the check has to stay sensible");
    const avoidIf: string[] = ["Strict budgets when reviews flag price surprises or small portions"];
    if (score.priceRealityScore >= 50) {
      avoidIf.push("Expecting upbeat “cheap” on-card cues to match the final bill every time");
    }
    if (score.waitRiskScore >= 58) avoidIf.push("Rushed meals with no buffer if the kitchen or line backs up");
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  if (intent.kind === "luxury") {
    const bestFor: string[] = ["Splurge nights when you have time for pacing, wine, and service"];
    if (place.priceLevel >= 3) bestFor.push("Guests who already expect a higher check and dress the part");
    bestFor.push("Hosts who confirm tasting menus, dietary needs, and cancellation rules up front");
    const avoidIf: string[] = ["Last-minute bookings when reviews mention tight tables or long waits"];
    avoidIf.push("Budget caps that cannot flex if the experience runs long");
    if (score.vibeGapScore > GAP_LOW_MAX) avoidIf.push("Trusting polished goal-cue text alone when reviews question value or consistency");
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  const bestFor: string[] = [];
  const avoidIf: string[] = [];

  if (place.averageRating >= 4.0) bestFor.push("Food-led visits with time to enjoy the menu");
  if (score.laptopFriendlyScore >= 55) bestFor.push("Low-key weekday sessions when you might open a laptop");
  if (place.priceLevel <= 2) bestFor.push("Casual plans where price sensitivity matters");
  if (bestFor.length === 0) {
    bestFor.push("A quick recon visit after skimming five recent reviews, not one catchy headline card");
  }

  if (score.waitRiskScore >= 60) avoidIf.push("Tight itineraries with no buffer for lines or pacing");
  if (score.touristDensityScore >= 60) avoidIf.push("Peak travel windows if you dislike dense crowds");
  if (score.priceRealityScore >= 55) {
    avoidIf.push("Expecting menu prices to match upbeat on-card goal cues when mismatch risk is high");
  }
  if (score.laptopFriendlyScore < 40) avoidIf.push("Deep-focus remote work during dinner rush");
  if (score.intentFitScore < 35 && score.vibeGapScore <= GAP_MED_MAX) {
    const msg = "Relying on this venue for the specific goal in your search";
    if (!avoidIf.includes(msg)) avoidIf.push(msg);
  }
  if (avoidIf.length === 0) {
    avoidIf.push("Assuming one on-card cue line represents every hour of service");
  }

  return { bestFor, avoidIf };
}

function buildRecommendation(
  vibeGapScore: number,
  intentFitScore: number,
  detectedIntent: DetectedIntent,
  place: PlaceData,
  bestFor: string[],
  avoidIf: string[],
): Recommendation {
  const ratingLine = `For this demo, ${place.name} is modeled at ${place.averageRating.toFixed(1)} / 5 across ${place.reviewCount.toLocaleString()} reviews.`;

  const isStudyLike = detectedIntent.kind === "study_work" || detectedIntent.kind === "quiet_calm";
  const lowIntent = intentFitScore < 38;
  const lowVibeGap = vibeGapScore <= GAP_LOW_MAX;

  let headline: string;
  if (isStudyLike && lowIntent && lowVibeGap) {
    headline = "Not recommended for quiet study or deep work.";
  } else if (vibeGapScore <= GAP_LOW_MAX) {
    headline = "Cues and reviews look aligned.";
  } else if (vibeGapScore <= GAP_MED_MAX) {
    headline = "Some mismatch — go with the right expectations.";
  } else {
    headline = "High signal mismatch — lean on review themes.";
  }

  let body: string;
  if (isStudyLike && lowIntent && lowVibeGap) {
    body = usesGoogleReviewSignals(place)
      ? `${ratingLine} goal-cue text and available Google review signals mostly agree this place is energetic and busy, so the signal-gap score (${vibeGapScore}/100) is not the main issue. The bigger issue is Intent Fit (${intentFitScore}/100): it is not a good match for quiet studying or deep work. Laptop-friendly scoring reflects the same noisy, high-energy cues. Still read fresh Google reviews alongside this read.`
      : `${ratingLine} Goal-cue text and reviews mostly agree this place is energetic and busy, so the signal-gap score (${vibeGapScore}/100) is not the main issue. The bigger issue is Intent Fit (${intentFitScore}/100): it is not a good match for quiet studying or deep work. Laptop-friendly scoring reflects the same noisy, high-energy cues. Still read fresh reviews alongside this read.`;
  } else {
    const planLine = `Practical fit: ${bestFor[0] ?? "a quick reconnaissance visit"}. Watch out if ${avoidIf[0]?.toLowerCase() ?? "goal-cue text oversimplifies the room"}.`;
    body =
      vibeGapScore <= GAP_LOW_MAX
        ? usesGoogleReviewSignals(place)
          ? `${ratingLine} ${planLine} Signal gap (${vibeGapScore}/100) stays low because on-card goal cues and review themes line up in the available Google review signals.`
          : `${ratingLine} ${planLine} Signal gap (${vibeGapScore}/100) stays low because on-card goal cues and review themes line up in this snapshot.`
        : vibeGapScore <= GAP_MED_MAX
        ? `${ratingLine} ${planLine} Signal gap (${vibeGapScore}/100) is elevated where on-card goal cues drift from recurring review themes.`
        : `${ratingLine} ${planLine} Signal gap (${vibeGapScore}/100) is high — anchor expectations on review themes, not the most aspirational on-card goal cues.`;

    if (detectedIntent.kind !== "venue_lookup") {
      const intentLabel =
        intentFitScore >= 70
          ? "strong alignment"
          : intentFitScore >= 45
            ? "mixed alignment"
            : "weak alignment";
      body += ` Intent Fit (${intentFitScore}/100) shows ${intentLabel} with “${detectedIntent.label.toLowerCase()}”.`;
    }
  }

  return { headline, body };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
