import { classifyQueryMode } from "@/lib/ai/queryMode";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { resolvePlaceForReport } from "@/lib/places/resolvePlaceForReport";
import { getMockSocialContentMode, getMockSocialForPlace } from "@/lib/social/mockSocialProvider";
import type {
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

/** VibeGap Score: low = social and reviews tell a similar story; high = they conflict. */
const GAP_LOW_MAX = 32;
const GAP_MED_MAX = 64;

function resolveReportIntent(searchQuery: string, classification: { queryMode: QueryMode; intentGoalText: string | null }): DetectedIntent {
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

function formatPlaceIntentGoalDisplay(goalFragment: string, intent: DetectedIntent): string {
  switch (intent.kind) {
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

/** True when review themes/snippets are sourced from Google Places (social remains mocked). */
function usesGoogleReviewSignals(place: PlaceData): boolean {
  return place.dataSource === "google";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a full mock report. Scoring is split into:
 * - VibeGap: social narrative vs. review narrative (never uses “user goal” rules).
 * - Intent Fit: inferred query goal vs. what reviews + posts imply about the visit.
 */
export async function buildMockVibeReport(searchQuery: string): Promise<VibeReport> {
  const intentInitial = detectIntentFromQuery(searchQuery);
  const classification = classifyQueryMode(searchQuery, intentInitial);
  const detectedIntent = resolveReportIntent(searchQuery, classification);
  const place = await resolvePlaceForReport(searchQuery, classification, detectedIntent);
  const socialHighlights = getMockSocialForPlace(place);

  const hypeIndex = averageHypeIndex(socialHighlights);
  const socialBlob = joinSocialText(socialHighlights);
  const reviewBlob = buildReviewBlob(place);

  const mismatch = buildSocialReviewMismatch(socialHighlights, reviewBlob, place);
  const realityIndex = computeRealityIndex(place, reviewBlob, mismatch.crowdedReality, mismatch.expensiveReality);
  const divergence = computeHypeRealityDivergence(hypeIndex, realityIndex);

  const vibeGapScore = finalizeVibeGapScore(mismatch, divergence);
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
  const { bestFor, avoidIf } = deriveTags(place, score, detectedIntent);
  const recommendation = buildRecommendation(
    vibeGapScore,
    intentFit.score,
    detectedIntent,
    place,
    bestFor,
    avoidIf,
  );

  return {
    searchQueryDisplay: formatSearchQueryForDisplay(searchQuery),
    queryMode: classification.queryMode,
    placeNameCandidate: classification.placeNameCandidate,
    queryExplanation: classification.queryExplanation,
    queryContextBanner: classification.queryContextBanner,
    placeIntentGoalDisplay,
    place,
    socialHighlights,
    socialSummary,
    realitySummary,
    score,
    detectedIntent,
    quickVerdict,
    bestFor,
    avoidIf,
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Intent detection (search query only)
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<UserIntentKind, readonly string[]> = {
  study_work: ["study", "studying", "laptop", "wifi", "work", "homework", "focus", "reading"],
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
  budget_eats: ["cheap", "budget", "affordable", "inexpensive", "deal", "value"],
  luxury: ["luxury", "splurge", "fancy", "special", "tasting", "celebration", "upscale"],
  quiet_calm: ["quiet", "calm", "peaceful", "chill", "low key", "low-key", "serene"],
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
function detectIntentFromQuery(rawQuery: string): DetectedIntent {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return {
      kind: "venue_lookup",
      label: "Venue lookup",
      confidence: "low",
      matchedSignals: [],
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
// VibeGap: social vs. reviews only
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
  /** Social clips and reviews both describe a busy / loud / wait-heavy room. */
  socialReviewAgreeBusy: boolean;
  vibeGapBullets: string[];
  /** Points driving VibeGap up — excludes “agreement” bullets (score stays low when aligned). */
  mismatchPoints: number;
};

/**
 * Compares **visible** mock social cards to review text. Uses the same calm vs. lively pack as the UI
 * (`getMockSocialContentMode`) so rationale never claims “calm posts” when the lively pack is showing.
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
      `Evidence: this draw uses the lively mock clip pack (tags such as ${tagSample}), and reviews echo busy or wait-heavy language (${reviewSample}) — social and reviews agree, so VibeGap stays low.`,
    );
  }

  if (hiddenGemHype && highReviewVolume) {
    vibeGapBullets.push(
      `Evidence: posts still use discovery language (“${snippet(socialBlob, "hidden gem|underrated|secret")}”), while ${place.reviewCount.toLocaleString()} reviews imply the venue is already mainstream.`,
    );
    mismatchPoints += 22;
  }

  if (socialCalmPackActive && crowdedReality) {
    vibeGapBullets.push(
      `Evidence: the calm clip pack shows study-, hush-, or no-wait framing (${tagSample}), but review snippets emphasize noise, crowding, or waits (${reviewSample}).`,
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
      "Evidence: posts imply walk-in ease, while reviews still surface lines, pacing, or reservation friction.",
    );
    mismatchPoints += 20;
  } else if (waitReality && socialCalmPackActive) {
    vibeGapBullets.push(
      "Evidence: reviews mention waits or pacing alongside a low-key, “no rush” storyline in the calm clip pack.",
    );
    mismatchPoints += 12;
  }

  if (socialBusyPack && !crowdedReality) {
    vibeGapBullets.push(
      usesGoogleReviewSignals(place)
        ? `Evidence: clips read energetic (${tagSample}), while the available Google review signals are comparatively tame on waits and noise — a partial, not total, narrative gap.`
        : `Evidence: clips read energetic (${tagSample}), while this mock review slice is comparatively tame on waits and noise — a partial, not total, narrative gap.`,
    );
    mismatchPoints += 20;
  }

  const hadConflictMismatch = mismatchPoints > 0;

  if (!hadConflictMismatch && !socialReviewAgreeBusy) {
    vibeGapBullets.push(
      usesGoogleReviewSignals(place)
        ? "Evidence: visible captions/tags and review themes line up in the available Google review signals — any remaining deltas look situational (timing, seating, or party size)."
        : "Evidence: visible captions/tags and review themes line up in this mock slice — any remaining deltas look situational (timing, seating, or party size).",
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
  const theme = place.reviewThemes.find((t) => t.sentiment === "negative")?.label;
  const line = place.complaints[0] ?? snippet(reviewBlob, "wait|line|loud|crowd|busy");
  const parts = [theme ? `theme: ${theme}` : null, line ? `text: “${line.slice(0, 52)}${line.length > 52 ? "…" : ""}”` : null].filter(
    Boolean,
  ) as string[];
  return parts.length > 0 ? parts.join("; ") : snippet(reviewBlob, "wait|line|loud|noise");
}

/** Short illustrative fragment for rationale copy (mock only). */
function snippet(blob: string, altPattern: string): string {
  const m = blob.match(new RegExp(`(${altPattern})`, "i"));
  return m?.[1] ? m[1].slice(0, 24) : "…";
}

function finalizeVibeGapScore(mismatch: MismatchSignals, divergence: number): number {
  if (mismatch.mismatchPoints > 0) {
    return clamp(Math.round(mismatch.mismatchPoints + divergence * 0.35), 18, 100);
  }
  if (mismatch.socialReviewAgreeBusy) {
    return clamp(Math.round(10 + divergence * 0.4), 6, 28);
  }
  return clamp(Math.round(8 + divergence * 0.55), 4, GAP_LOW_MAX);
}

function verdictForVibeGap(vibeGapScore: number): string {
  if (vibeGapScore <= GAP_LOW_MAX) {
    return "Social clips and reviews largely agree on what this place feels like day to day.";
  }
  if (vibeGapScore <= GAP_MED_MAX) {
    return "There is a clear gap between the highlight reel and what reviewers consistently report.";
  }
  return "Strong conflict — the feed’s story often diverges from aggregated review reality.";
}

/** Intent Fit bands for quick verdict copy (V2.3). */
const INTENT_HIGH_MIN = 60;
const INTENT_LOW_MAX = 47;

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
    framed = `Illustrative mock venue for your goal — ${explanation}`;
  } else if (mode === "specific_place") {
    framed = `Named venue — ${explanation}`;
  } else {
    framed = `Named venue and goal — ${explanation}`;
  }
  if (place.dataSource === "google" && place.isRealPlaceData) {
    framed = `${framed} Google confirms the venue details; social comparison is still mocked in this prototype.`;
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
        title: "Good match for a casual visit",
        explanation: gRev
          ? "Without a specific goal in your search, the headline is alignment: mock social clips and available Google review signals describe a similar room — still skim for waits or price."
          : "Without a specific goal in your search, the headline is alignment: clips and reviews describe a similar room in this mock — still skim for waits or price.",
      };
    }
    return {
      title: "Social and reviews disagree — read before you go",
      explanation:
        "No visit goal was parsed, so focus on the mismatch: posts and reviews are telling different stories. A few fresh reviews beat the highlight reel.",
    };
  }

  if (highIntent && gapLow) {
    if (k === "party_nightlife") {
      return {
        title: "Good for a lively night out — but expect crowds and waits.",
        explanation:
          "Clips and reviews both describe a high-energy room in this draw — treat lines, volume, and timing as normal parts of the night, not a surprise.",
      };
    }
    if (k === "budget_celebration") {
      return {
        title: "Good match — social and reviews agree.",
        explanation: gRev
          ? "For a budget-friendly celebration, the feed and review themes line up on value, waits, and crowding in the available Google review signals — still confirm menu math, tax, and tip so the bill matches the occasion."
          : "For a budget-friendly celebration, the feed and review themes line up on value, waits, and crowding in this mock — still confirm menu math, tax, and tip so the bill matches the occasion.",
      };
    }
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Good match — social and reviews agree.",
        explanation:
          "For quiet or focused time, posts and reviews point the same direction here — pick a calm window and double-check seating, but the big story looks consistent.",
      };
    }
    return {
      title: "Good match — social and reviews agree.",
      explanation: gRev
        ? "For what you searched, mock clips and available Google review signals are not fighting each other — use Intent Fit as your green light, then handle the usual logistics (hours, reservations, seating)."
        : "For what you searched, clips and reviews are not fighting each other in this mock — use Intent Fit as your green light, then handle the usual logistics (hours, reservations, seating).",
    };
  }

  if (highIntent && !gapLow) {
    if (k === "party_nightlife") {
      return {
        title: "Good for a lively night out — but expect crowds and waits.",
        explanation:
          "The vibe still fits a night out, but posts may gloss over lines, packed dance floors, or pacing friction that reviewers repeat — leave extra time for entry or waits.",
      };
    }
    if (k === "budget_celebration") {
      return {
        title: "Good for your goal — but clips may gloss over the rough edges.",
        explanation:
          "A celebration on a budget can still work, yet posts may play down tabs, waits, or a loud room — align on price, timing, and how “special” the night needs to feel before you invite everyone.",
      };
    }
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Possible for your goal — verify the calm story.",
        explanation:
          "Intent Fit looks decent, but social and reviews are not perfectly aligned on noise or crowding — skim recent comments for loud or crowded stretches before you book a long study block.",
      };
    }
    return {
      title: "Good for your goal — but social media may be misleading.",
      explanation:
        "The place may still suit what you want, yet clips and reviews disagree enough that surprises are likely — anchor on review themes for waits, noise, and price.",
    };
  }

  if (lowIntent && gapLow) {
    const reviewBusy = /\b(loud|noise|crowd|packed|busy|wait|line)\b/i.test(reviewBlob);
    if ((k === "study_work" || k === "quiet_calm") && mismatch.socialMode === "lively" && reviewBusy) {
      return {
        title: "Skip it for studying.",
        explanation:
          "Social posts and reviews both point to a busy, high-energy place. The issue is not hype mismatch — it is poor fit for quiet work.",
      };
    }
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Skip it for your goal — social and reviews agree.",
        explanation:
          "Channels line up on noise, turnover, or seating that clashes with focus or calm — the honest read is a miss for what you typed.",
      };
    }
    if (k === "party_nightlife") {
      return {
        title: "Skip it for a party night — channels agree.",
        explanation: gRev
          ? "Clips and available Google review signals both describe a room that does not deliver the nightlife energy you asked for — pick a different spot rather than hoping it transforms at 10 p.m."
          : "Clips and reviews both describe a room that does not deliver the nightlife energy you asked for in this mock — pick a different spot rather than hoping it transforms at 10 p.m.",
      };
    }
    if (k === "budget_celebration") {
      return {
        title: "Skip it for a budget celebration.",
        explanation:
          "Posts and reviews both imply price pressure, waits, or crowding that fights a tight, special-occasion plan — agreement here means a clean “no,” not a mystery.",
      };
    }
    return {
      title: "Skip it for your goal — social and reviews agree.",
      explanation:
        "The channels tell the same story, and that story is a poor match for what you searched — believe the agreement and pick elsewhere.",
    };
  }

  if (lowIntent && !gapLow) {
    if (k === "budget_celebration") {
      return {
        title: "Risky for a budget celebration.",
        explanation:
          "Social posts frame it as cheap or easy, but reviews suggest price pressure, waits, or crowding — poor goal fit plus unreliable hype is a tough combo for a celebration on a cap.",
      };
    }
    return {
      title: "Risky choice — poor goal fit and unreliable hype.",
      explanation:
        "Intent Fit is weak while social and reviews disagree — you would be betting on a place that does not match your goal and where the feed is not a reliable guide.",
    };
  }

  if (midIntent && gapLow) {
    if (k === "study_work" || k === "quiet_calm") {
      return {
        title: "Uncertain for studying — check recent noise and seating reviews.",
        explanation:
          "Intent Fit sits in the gray zone while social and reviews mostly agree — that often means seat-by-seat luck. Skim very fresh notes on volume, turnover, outlets, and table size before you bank on a long session.",
      };
    }
    return {
      title: "Moderate fit — channels mostly agree.",
      explanation:
        "Intent Fit sits in the middle: not a slam dunk for your goal, but social and reviews are not contradicting each other here — a careful visit can still work if you read fresh notes.",
    };
  }

  return {
    title: "Uncertain fit — mixed goal match and noisy signals.",
    explanation:
      "Intent Fit is middling while social and reviews pull in different directions — treat this as a yellow light: anchor on recent reviews and keep a backup plan.",
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
  const b2 = socialLineForEvidence(kind, mismatch, socialBlob);
  const b3 = thirdEvidenceLine(score, kind, place);
  return [b1, b2, b3];
}

function selectReviewLineForEvidence(place: PlaceData, reviewBlob: string, kind: UserIntentKind): string {
  if (kind === "party_nightlife") {
    const hit = place.complaints.find((c) => /\b(wait|line|crowd|packed|loud|music|noise|dj)\b/i.test(c));
    if (hit) {
      return `Reviews keep surfacing: “${hit}” — plan for waits and volume, not just the clip mood.`;
    }
  }
  if (kind === "budget_celebration" || kind === "budget_eats") {
    const hit = place.complaints.find((c) =>
      /\b(expensive|overpriced|wait|line|portion|worth|bill|price)\b/i.test(c),
    );
    if (hit) {
      return `Review snippets warn about: “${hit}” — that matters when you need the check to stay predictable.`;
    }
    if (/\b(expensive|overpriced|wait|line|portion)\b/i.test(reviewBlob)) {
      return `Reviews lean on words like “${snippet(reviewBlob, "expensive|overpriced|wait|portion|worth|line")}” — glance at the menu prices before you toast.`;
    }
  }
  if (kind === "study_work" || kind === "quiet_calm") {
    const hit = place.complaints.find((c) => /\b(loud|noise|wait|line|crowd|packed|busy|seating|small)\b/i.test(c));
    if (hit) {
      return `For quiet or laptop use, reviews often mention: “${hit}” — that clashes with focus work.`;
    }
  }
  return pickReviewEvidenceLine(place, reviewBlob);
}

function socialLineForEvidence(kind: UserIntentKind, mismatch: MismatchSignals, socialBlob: string): string {
  if (kind === "party_nightlife") {
    if (mismatch.socialMode === "lively") {
      return "Clips skew DJ-forward, packed-room energy — loud music and crowd motion read clearly in this sample.";
    }
    return "Clips read softer than peak club hours — still compare to reviews on bass, last call, and when the room actually fills.";
  }
  if (kind === "budget_celebration" || kind === "budget_eats") {
    if (/\b(cheap|budget|deal|steal|value)\b/i.test(socialBlob)) {
      return "Social captions push easy value and shareable moments — weigh that against bill frustration reviewers sometimes repeat.";
    }
    return "Social framing still skews appetizing and fun — pair it with a quick scan for price and wait themes in reviews.";
  }
  return mismatch.socialMode === "lively"
    ? "Posts read loud, line-prone, and high-energy — not the calm, focused vibe you would want for deep work."
    : "Posts lean calmer or easier access — compare that storyline to what reviewers say about crowding, noise, or waits.";
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
      : "Music, crowd energy, and weekend pacing in reviews line up with a nightlife-forward night in this mock draw.";
  }

  if (kind === "budget_celebration" || kind === "budget_eats") {
    if (score.priceRealityScore >= 50) {
      return "Price mismatch risk looks meaningful — easy value framing on social may not match how the check lands in reviews.";
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
      ? "Family cues in reviews and clip tone are not fully aligned — double-check kid policies, volume, and high-chair availability."
      : "Posts and reviews mostly agree on the vibe family-wise — still confirm booster seats or stroller space if you need them.";
  }

  if (kind === "luxury") {
    return score.priceRealityScore >= 50
      ? "Splurge expectations bump into value complaints in reviews — calibrate before you commit a special-occasion budget."
      : gRev
        ? "Upscale signals look steadier in the available Google review signals — still validate wine, tasting, or dress code details outside VibeGap."
        : "Upscale signals look steadier in this mock slice — still validate wine, tasting, or dress code details outside VibeGap.";
  }

  return score.vibeGapScore > GAP_LOW_MAX
    ? "With no parsed goal, lean on the disagreement itself: clip promises drift from what reviewers keep repeating."
    : "Without a parsed goal, clips and reviews line up enough that there is no big mystery to solve here.";
}

function pickReviewEvidenceLine(place: PlaceData, reviewBlob: string): string {
  const hit = place.complaints.find((c) => /\b(loud|noise|wait|line|crowd|busy|packed|reservation)\b/i.test(c));
  if (hit) {
    return `Reviews often mention: “${hit}”`;
  }
  const theme = place.reviewThemes.find((t) => t.sentiment === "negative")?.label;
  if (theme) {
    const t = theme.toLowerCase();
    return usesGoogleReviewSignals(place)
      ? `Review themes call out ${t} more than once in the available Google review signals.`
      : `Review themes call out ${t} more than once in this mock set.`;
  }
  if (/\b(loud|noise|wait|line|crowd)\b/i.test(reviewBlob)) {
    return `Review snippets repeat words like “${snippet(reviewBlob, "loud|noise|wait|line|crowd|busy")}” — worth noting before you go.`;
  }
  return usesGoogleReviewSignals(place)
    ? "Available Google review signals look fairly steady — no single complaint dominates the snapshot."
    : "Reviews in this mock look fairly steady — no single complaint dominates the snapshot.";
}

// ---------------------------------------------------------------------------
// Intent Fit: user goal vs. modeled reality
// ---------------------------------------------------------------------------

type IntentFitResult = { score: number; verdict: string; bullets: string[] };

/**
 * Scores how well the venue matches the user’s inferred goal using reviews + social as “what you’ll get”.
 * High score = good fit; low score = your goal is poorly served. Independent of social-vs-review agreement.
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
        `The report still compares social tone to reviews for “${place.name}” — add goal words (e.g. “quiet study”, “cheap eats”) to score intent more sharply.`,
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
              `The visible "${socialMode}" mock pack and review snippets both skew energetic or wait-heavy — weak match for your goal. Laptop-friendly score (${laptopFriendlyScore}/100) backs that read.`,
              "VibeGap stays low when channels agree; Intent Fit is the main red flag for study-style plans.",
            ]
          : [
              `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 4).join(", ") || "query cues"}).`,
              "Reviews emphasize noise, crowding, waits, or turnover — a rough match for quiet work even when clips look softer.",
            ],
      };
    }
    if (!busySignal && calmSignal) {
      return {
        score: 82,
        verdict: "Strong fit for a calmer or work-friendly visit (based on mock text).",
        bullets: [
          `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 4).join(", ")}).`,
          "Review excerpts and post tone both lean quieter or more controlled — aligned with your stated goal.",
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
            : "Mock themes include both energetic and calmer cues — treat this as a reminder to read the latest reviews before planning deep work.",
        gRev
          ? "If you need silence, favor off-peak windows and seats away from the service path — social clips here are still mocked."
          : "If you need silence, favor off-peak windows and seats away from the service path (mock).",
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
            ? "Posts and reviews skew loud, social, and weekend-forward — that usually supports a party night; lines and packed rooms read as normal friction, not a goal misfit."
            : "The mock draw is upbeat but not a guaranteed club night — skim for DJ calendars vs. slow nights before you dress up.",
          nightlifeRoom
            ? "The lively clip pack lines up with high-tempo expectations — still pick an arrival window that tolerates a wait."
            : "Clip tone is mixed in this sample — pair it with review notes on crowd, music, and pacing.",
        ],
      };
    }

    return {
      score: 54,
      verdict: "Soft signals for a big night out — confirm the room before you commit.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()}.`,
        "Posts and reviews are not consistently loud-nightlife here — check hours, DJs, and cover before you rally the group.",
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
          : "Reasonable fit for date night in this mock slice.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        chaotic
          ? gRev
            ? "Reviews skew loud or busy without strong ‘intimate table’ language — a risky pick for a quiet anniversary unless you book off-peak."
            : "Reviews skew loud or busy without strong ‘intimate table’ language — a risky pick for a quiet anniversary unless you book off-peak (mock)."
          : gRev
            ? "Social and reviews leave room for a polished table experience — still confirm reservations and seating; social clips remain mocked in this prototype."
            : "Social and reviews leave room for a polished table experience — still confirm reservations and seating (mock).",
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
          ? "Reasonable fit for a casual celebration on a budget (mock)."
          : "Mixed fit — workable only if the group is flexible on spend, timing, and noise (mock).";

    const bullets: string[] = [
      `Matched goal: ${intent.label.toLowerCase()} (${intent.matchedSignals.slice(0, 5).join(", ") || "query cues"}).`,
      badValue
        ? "Review language flags price pressure, smaller portions, or “not worth it” vibes — risky when the bill has to feel celebration-ready."
        : gRev
          ? "Review themes are not screaming value traps in the available Google review signals — still confirm menu pricing before you gather everyone."
          : "Review themes are not screaming value traps in this mock slice — still confirm menu pricing before you gather everyone.",
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
      verdict: badValue ? "Weak fit for a strict budget." : "Decent fit for value-seeking plans (mock).",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        badValue
          ? "Review snippets reference price pressure or smaller portions — misaligned with a tight budget goal."
          : gRev
            ? "Review themes do not overwhelmingly contradict a budget-minded visit in the available Google review signals."
            : "Review themes do not overwhelmingly contradict a budget-minded visit in this mock dataset.",
      ],
    };
  }

  if (intent.kind === "luxury") {
    const luxSignals =
      place.priceLevel >= 3 && place.averageRating >= 3.9 && /\b(wine|sommelier|tasting|chef)\b/i.test(reviewBlob);
    return {
      score: luxSignals ? 80 : 50,
      verdict: luxSignals ? "Good fit for an upscale occasion (mock)." : "Mixed signals for a luxury expectation.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        luxSignals
          ? "Higher price band and positive food or service themes support a splurge-style visit in this illustration."
          : "Mock data does not clearly confirm a white-tablecloth experience — validate menu and dress code elsewhere.",
      ],
    };
  }

  if (intent.kind === "family") {
    const hostile =
      /\b(loud|bar|shots|nightclub|21\+|adults only)\b/i.test(reviewBlob) ||
      /\b(loud|bar|shots|nightclub)\b/i.test(socialBlob);
    return {
      score: hostile ? 30 : 68,
      verdict: hostile ? "Risky for a family-first outing in this mock read." : "Acceptable family fit in mock themes.",
      bullets: [
        `Matched intent: ${intent.label.toLowerCase()} (${intent.matchedSignals.join(", ")}).`,
        hostile
          ? "Language in reviews or posts leans adult-night-out — double-check kid policies before booking."
          : "No strong ‘adults-only’ red flags in the sampled mock text — still verify high chairs and noise with the venue.",
      ],
    };
  }

  return {
    score: 55,
    verdict: "Neutral intent scoring fallback.",
    bullets: ["Unable to specialize this intent in the mock engine — treat Intent Fit as illustrative only."],
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

  const waitRiskScore = clamp(
    (mismatch.waitReality ? 38 : 12) +
      (socialWaitOrCrowd ? 18 : 0) +
      (mismatch.crowdedReality ? 20 : 0) +
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
  if (mismatch.socialCalmPackActive && mismatch.crowdedReality) laptopFriendlyScore -= 12;

  const priceMismatchRisk = clamp(
    (mismatch.cheapSocial && mismatch.expensiveReality ? 58 : 14) + (place.priceLevel >= 4 ? 14 : 0),
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
  const tagLine = [...tags].slice(0, 6).join(", ") || "see on-card tags";
  const pack =
    mode === "lively"
      ? "the lively mock clip pack (lines, crowds, DJ or party cues on the cards)"
      : "the calm mock clip pack (quiet table, study, or easy-access cues on the cards)";
  return `This sample uses ${pack}. Visible vibe tags include: ${tagLine}. VibeGap compares those clips to review text; Intent Fit compares both to the goal parsed from your search.`;
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
    if (score.vibeGapScore > GAP_LOW_MAX) avoidIf.push("Trusting clip aesthetics alone when reviews mention noise or crowding");
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
      avoidIf.push("Expecting viral “cheap” captions to match the final bill every time");
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
    if (score.vibeGapScore > GAP_LOW_MAX) avoidIf.push("Trusting glossy posts when reviews question value or consistency");
    return { bestFor: bestFor.slice(0, 3), avoidIf: avoidIf.slice(0, 3) };
  }

  const bestFor: string[] = [];
  const avoidIf: string[] = [];

  if (place.averageRating >= 4.0) bestFor.push("Food-led visits with time to enjoy the menu");
  if (score.laptopFriendlyScore >= 55) bestFor.push("Low-key weekday sessions when you might open a laptop");
  if (place.priceLevel <= 2) bestFor.push("Casual plans where price sensitivity matters");
  if (bestFor.length === 0) {
    bestFor.push("A quick recon visit after skimming five recent reviews, not one viral clip");
  }

  if (score.waitRiskScore >= 60) avoidIf.push("Tight itineraries with no buffer for lines or pacing");
  if (score.touristDensityScore >= 60) avoidIf.push("Peak travel windows if you dislike dense crowds");
  if (score.priceRealityScore >= 55) {
    avoidIf.push("Expecting menu prices to match budget-hype clips when mismatch risk is high");
  }
  if (score.laptopFriendlyScore < 40) avoidIf.push("Deep-focus remote work during dinner rush");
  if (score.intentFitScore < 35 && score.vibeGapScore <= GAP_MED_MAX) {
    const msg = "Relying on this venue for the specific goal in your search";
    if (!avoidIf.includes(msg)) avoidIf.push(msg);
  }
  if (avoidIf.length === 0) {
    avoidIf.push("Assuming one viral clip represents every hour of service");
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
    headline = "Likely matches the online vibe.";
  } else if (vibeGapScore <= GAP_MED_MAX) {
    headline = "Some mismatch — go with the right expectations.";
  } else {
    headline = "High mismatch — social vibe may be misleading.";
  }

  let body: string;
  if (isStudyLike && lowIntent && lowVibeGap) {
    body = usesGoogleReviewSignals(place)
      ? `${ratingLine} Social posts (still mocked here) and available Google review signals mostly agree this place is energetic and busy, so VibeGap (${vibeGapScore}/100) is not the main issue. The bigger issue is Intent Fit (${intentFitScore}/100): it is not a good match for quiet studying or deep work. Laptop-friendly scoring reflects the same noisy, high-energy cues. Still read fresh Google reviews alongside this prototype read.`
      : `${ratingLine} Social posts and reviews mostly agree this place is energetic and busy, so VibeGap (${vibeGapScore}/100) is not the main issue. The bigger issue is Intent Fit (${intentFitScore}/100): it is not a good match for quiet studying or deep work. Laptop-friendly scoring reflects the same noisy, high-energy cues. Still read fresh reviews — this is illustrative mock data.`;
  } else {
    const planLine = `Practical fit: ${bestFor[0] ?? "a quick reconnaissance visit"}. Watch out if ${avoidIf[0]?.toLowerCase() ?? "clips oversimplify the room"}.`;
    body =
      vibeGapScore <= GAP_LOW_MAX
        ? usesGoogleReviewSignals(place)
          ? `${ratingLine} ${planLine} VibeGap (${vibeGapScore}/100) stays low because the visible mock clip pack and review themes line up in the available Google review signals.`
          : `${ratingLine} ${planLine} VibeGap (${vibeGapScore}/100) stays low because the visible clip pack and review themes line up in this mock slice.`
        : vibeGapScore <= GAP_MED_MAX
          ? `${ratingLine} ${planLine} VibeGap (${vibeGapScore}/100) is elevated where clip promises drift from recurring review themes.`
          : `${ratingLine} ${planLine} VibeGap (${vibeGapScore}/100) is high — anchor expectations on review themes, not the most aspirational posts.`;

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
