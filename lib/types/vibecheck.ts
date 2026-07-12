/**
 * Shared types for VibeGap — goal fit vs. venue signals from reviews.
 */

export type PriceLevel = 1 | 2 | 3 | 4;

export type ReviewThemeSentiment = "positive" | "negative" | "mixed";

export interface ReviewTheme {
  id: string;
  label: string;
  sentiment: ReviewThemeSentiment;
  /** How often this theme appears in reviews (0–100). */
  strength: number;
}

export interface Recommendation {
  headline: string;
  body: string;
}

export type DecisionLabel = "GO" | "MAYBE" | "SKIP";
export type DecisionConfidence = "High" | "Medium" | "Low";

export interface DecisionSummary {
  label: DecisionLabel;
  confidence: DecisionConfidence;
  reason: string;
}

export interface CandidateDecision {
  label: DecisionLabel;
  confidence: DecisionConfidence;
}

export interface RankedCandidate {
  place: PlaceData;
  decision: CandidateDecision;
  fitScore: number;
  oneSentenceReason: string;
  /** Human GO/MAYBE/SKIP headline (decision analytics tone). */
  decisionToneLine: string;
  rankReason: string;
  scoreDriver: string;
  mainRisk: string;
  bestFor: string;
  avoidIf: string;
  scoreBreakdown: {
    label: string;
    score: number;
    explanation: string;
  }[];
  /** Straight-line distance from the search anchor when both have coordinates. */
  distanceFromAnchorMeters?: number | null;
  /** Optional transparent note; does not change ranking scores. */
  geographySignalLine?: string | null;
  /** V28: deterministic intent-shape tier for this row (optional). */
  intentQualityTier?: "strong" | "acceptable" | "weak" | "poor";
  /** Short user-facing note from the quality gate (optional). */
  intentQualitySummary?: string | null;
  /** V29: optional label from recommendation style (Reliable / Balanced / Discovery). */
  recommendationStyleLabel?: string | null;
  /** V30: curated shortlist role for this row (optional). */
  shortlistRole?: string;
}

export interface RecommendationGeography {
  searchAreaLabel: string;
  nearAnchorDisplayName: string | null;
  anchorLatitude: number | null;
  anchorLongitude: number | null;
  /** True when at least one candidate has a computed straight-line distance. */
  hasApproximateDistances: boolean;
}

/** Single-place geography for distance copy and future map (V24). */
export interface SinglePlaceGeography {
  searchAreaLabel: string | null;
  nearAnchorDisplayName: string | null;
  placeLatitude: number | null;
  placeLongitude: number | null;
  anchorLatitude: number | null;
  anchorLongitude: number | null;
  distanceFromAnchorMeters: number | null;
  /** When the venue has coordinates but no anchor distance is shown. */
  mapPreviewNote: string | null;
}

export interface RecommendationScoringWeight {
  label: string;
  weight: number;
}

export interface RecommendationInsights {
  topPickName: string;
  /** Primary reason the #1 candidate leads this shortlist. */
  whyItWon: string;
  /** One sentence on the main weakness or risk for the top pick. */
  mainTradeoff: string;
  /** Suggests a second candidate when priorities differ. */
  bestAlternativeIf: string;
  /** Transparent notes on lower-ranked or skipped picks (same scoring run). */
  whyNotThese: { placeName: string; oneLineReason: string }[];
  decisionSummary: string;
  strongestRisk: string;
  confidenceNote: string;
  scoringWeights: RecommendationScoringWeight[];
  decisionCounts: {
    go: number;
    maybe: number;
    skip: number;
  };
  whyRankedFirstBullets: string[];
}

/** Short, user-facing summary shown above the fold (V2.2). */
export interface QuickVerdict {
  title: string;
  /** One or two plain sentences — what to do, in human language. */
  explanation: string;
  /** Three scannable reasons tied to the same signals as the full report. */
  evidenceBullets: readonly [string, string, string];
}

export interface PlaceData {
  id: string;
  name: string;
  address: string;
  category: string;
  /** Aggregated rating from review sources (1–5). */
  averageRating: number;
  reviewCount: number;
  priceLevel: PriceLevel;
  reviewThemes: ReviewTheme[];
  recentReviewSummary: string;
  complaints: string[];
  positives: string[];
  /** When set on goal_search mock places, nudges illustrative venue/review flavor (server-only). */
  mockGoalIntentKind?: UserIntentKind;
  /** Provenance of place fields (mock vs Google Places). */
  dataSource?: "mock" | "google";
  /** Google resource id when `dataSource` is `google`. */
  googlePlaceId?: string;
  /** True when name/address/reviews come from Google Places. */
  isRealPlaceData?: boolean;
  /** True when we successfully extracted signals from real Google review text. */
  hasRealGoogleReviews?: boolean;
  /** Google Places `types` strings when `dataSource` is `google` (e.g. `tourist_attraction`). */
  googleTypes?: readonly string[];
  /** Google Places `primaryType` when available. */
  googlePrimaryType?: string;
  /** WGS84 latitude when returned by Google Places (for distance / future map). */
  latitude?: number;
  /** WGS84 longitude when returned by Google Places (for distance / future map). */
  longitude?: number;
  /** Short weekday hours line from Google listing when returned (not live occupancy). */
  weekdayHoursSummary?: string;
}

export type SocialSource = "tiktok" | "instagram" | "youtube";

export interface SocialPost {
  id: string;
  source: SocialSource;
  caption: string;
  hashtags: string[];
  vibeTags: string[];
  /** Placeholder thumbnail; null uses a gradient frame in the UI. */
  thumbnailUrl: string | null;
  postedAt: string;
  /** How strong the short cue lines on cards feel (0–100); not live social engagement. */
  hypeScore: number;
}

/** What the user appears to be optimizing for, inferred from the search string only. */
export type UserIntentKind =
  | "study_work"
  | "low_wait"
  | "date_night"
  | "budget_celebration"
  | "budget_eats"
  | "meal_style"
  | "luxury"
  | "quiet_calm"
  | "party_nightlife"
  | "family"
  | "venue_lookup";

export interface DetectedIntent {
  kind: UserIntentKind;
  /** Short human-readable label for UI. */
  label: string;
  /** How explicit the goal was in the query (venue-only searches are low). */
  confidence: "high" | "medium" | "low";
  /** Query tokens or phrases that supported the classification (for transparency). */
  matchedSignals: string[];
}

/** How the search string was read for scoring and copy (V2.5). */
export type QueryMode = "goal_search" | "specific_place" | "place_with_intent";

export interface VibeGapScore {
  /**
   * Mismatch between short card cues and review themes (0 = aligned, 100 = strong mismatch).
   * Does not measure whether the venue fits the user’s goal — see intentFitScore.
   */
  vibeGapScore: number;
  /**
   * How well the modeled venue matches the user’s inferred goal (0 = poor fit, 100 = strong fit).
   * Separate from the cue-vs-review signal gap above.
   */
  intentFitScore: number;
  intentFitVerdict: string;
  /** How “touristy” or crowded-tourist patterns feel from reviews (0–100). */
  touristDensityScore: number;
  /** Likelihood of long waits / lines (0–100). */
  waitRiskScore: number;
  /** Whether reviews support laptop / work-friendly visits (0–100). */
  laptopFriendlyScore: number;
  /** Higher = stronger mismatch between budget-friendly framing cues and review price/value signals (0–100). */
  priceRealityScore: number;
  /** One-line read of the signal gap score (card cues vs. reviews; not goal-fit). */
  verdict: string;
  hypeIndex: number;
  realityIndex: number;
  /** Evidence for the signal gap score — card cues vs. review narrative. */
  vibeGapExplanationBullets: string[];
  /** Evidence for Intent Fit — user goal vs. what reviews and venue signals imply you will get. */
  intentFitExplanationBullets: string[];
}

/** When a Google Places attempt did not yield live place data (mock fallback or not applicable). */
export type GooglePlacesFallbackKind = "none" | "no_confident_match" | "lookup_unavailable";

/** How the quick verdict / recommendation copy was produced (scores use defined rules). */
export type NarrativeSource = "rules" | "openai" | "gemini";

export interface VibeReport {
  /** Typo-normalized, title-cased query for display (detection still uses the raw search). */
  searchQueryDisplay: string;
  queryMode: QueryMode;
  /** Venue substring for `place_with_intent`; display form for `specific_place`; null for pure goal search. */
  placeNameCandidate: string | null;
  /** One sentence: how we interpreted the query (mock-only). */
  queryExplanation: string;
  /** Short header line, e.g. “Checking fit for your goal.” */
  queryContextBanner: string;
  /**
   * When `queryMode` is `place_with_intent`, a compact goal line for the header (e.g. “Quiet visit”).
   * Null otherwise.
   */
  placeIntentGoalDisplay: string | null;
  /** Google Text Search was attempted for named-venue modes but we fell back to mock place data. */
  googlePlacesFallback: GooglePlacesFallbackKind;
  /** Short query without obvious geography — suggest adding a city for better Google matching. */
  suggestPlaceDisambiguation: boolean;
  place: PlaceData;
  socialHighlights: SocialPost[];
  /** One-paragraph read of the short venue cues shown on cards (not live feeds). */
  socialSummary: string;
  /** What reviews consistently report. */
  realitySummary: string;
  score: VibeGapScore;
  /** Inferred visit goal from the raw search query (mock heuristic). */
  detectedIntent: DetectedIntent;
  /** Fast read: verdict, scores, reasons, tags — before full analysis. */
  decision: DecisionSummary;
  /** Fast read: verdict, scores, reasons, tags — before full analysis. */
  quickVerdict: QuickVerdict;
  bestFor: string[];
  avoidIf: string[];
  recommendation: Recommendation;
  generatedAt: string;
  /** How the quick verdict / recommendation copy was produced (scores use defined rules). */
  narrativeSource: NarrativeSource;
  /** True when an LLM successfully supplied polished copy merged into this report. */
  aiNarrativeUsed: boolean;
  /** Geography / distance context for future map (V24); optional. */
  geography?: SinglePlaceGeography | null;
  /** Listing-based timing hints (optional). */
  timingContextLines?: string[];
}

export interface ComparePlaceSide {
  place: PlaceData;
  decision: DecisionSummary;
  fitScore: number;
  vibeGapScore: number | null;
  waitRiskLabel: string;
  noiseCrowdingLabel: string;
  priceValueLabel: string;
  reviewConfidence: DecisionConfidence;
  mainRisk: string;
  bestFor: string;
  avoidIf: string;
  topReasons: string[];
  scoreBreakdown: RankedCandidate["scoreBreakdown"];
  googleResolved: boolean;
}

export interface CompareFactorRow {
  factor: string;
  placeAValue: string;
  placeBValue: string;
  advantage: string;
}

/** Compare-mode tuning slider family (maps to label packs; same underlying score dimensions). */
export type CompareTuningFamily = "study" | "low_wait" | "budget" | "occasion" | "food";

export interface CompareResult {
  searchQueryDisplay: string;
  detectedIntent: DetectedIntent;
  goalDisplay: string;
  /** Compare header title (stable single-line layout). */
  compareHeadlineTitle: string;
  /** Compare header subtitle, e.g. "Comparing X and Y in Haifa." */
  compareHeadlineSubtitle: string;
  /** True when the user supplied an explicit compare goal (not default “your visit”). */
  compareHasParsedGoal: boolean;
  /** When true, show Tune comparison sliders (parsed goal + supported family). */
  compareAllowsPriorityTuning: boolean;
  /** Tuning family for slider labels; null when tuning is off. */
  compareTuningFamily: CompareTuningFamily | null;
  placeAName: string;
  placeBName: string;
  sideA: ComparePlaceSide;
  sideB: ComparePlaceSide;
  winnerPlaceId: string;
  whyWinner: string;
  tradeoff: string;
  chooseWinnerIf: string;
  chooseOtherIf: string;
  factorRows: CompareFactorRow[];
  partialResolveMessage: string | null;
}

/** One stop in a multi-stop visit plan (v1: exactly two stops). */
export interface VisitPlanStop {
  /** Display label for the stop goal, e.g. "Coffee". */
  goalLabel: string;
  /** Raw goal span from the query, e.g. "coffee". */
  goalQuery: string;
  intent: DetectedIntent;
  /** Ranked pool for this stop (top ~8). */
  candidates: RankedCandidate[];
}

/** Shared geographic anchor for a visit plan (city, neighborhood, or landmark). */
export interface VisitPlanAnchor {
  displayName: string;
  /** Search-area text used for candidate fetches. */
  locationCandidate: string;
  latitude: number | null;
  longitude: number | null;
}

export interface VisitPlanResult {
  anchor: VisitPlanAnchor;
  stops: VisitPlanStop[];
}

export type VibecheckResponse =
  | {
      mode: "single_report";
      report: VibeReport;
    }
  | {
      mode: "compare";
      compare: CompareResult;
      sourceLabel: string;
    }
  | {
      mode: "recommendations";
      detectedIntent: DetectedIntent;
      locationCandidate: string;
      /** When set, UI title uses “near [name]” instead of “in [locationCandidate]”. */
      nearAnchorName?: string | null;
      /** Short note when a landmark/area was used as the geographic anchor for nearby picks. */
      anchorNote?: string | null;
      /** Parsed geography for distances and future map layers. */
      geography?: RecommendationGeography;
      candidates: RankedCandidate[];
      sourceLabel: string;
      recoveryMessage: null;
    }
  | {
      mode: "visit_plan";
      plan: VisitPlanResult;
      sourceLabel: string;
    }
  | {
      mode: "needs_location";
      detectedIntentLabel: string;
      locationCandidate: null;
      candidates: [];
      sourceLabel: string;
      recoveryMessage: string;
    };
