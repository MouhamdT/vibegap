/**
 * Shared types for VibeGap — social hype vs. review reality.
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
  /** Three scannable reasons tied to the same mock data as the full report. */
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
  /** When set on goal_search mock places, nudges illustrative social/review flavor (server-only). */
  mockGoalIntentKind?: UserIntentKind;
  /** Provenance of place fields (mock vs Google Places). */
  dataSource?: "mock" | "google";
  /** Google resource id when `dataSource` is `google`. */
  googlePlaceId?: string;
  /** True when name/address/reviews come from Google Places (still paired with mock social). */
  isRealPlaceData?: boolean;
  /** True when we successfully extracted signals from real Google review text. */
  hasRealGoogleReviews?: boolean;
  /** Google Places `types` strings when `dataSource` is `google` (e.g. `tourist_attraction`). */
  googleTypes?: readonly string[];
  /** Google Places `primaryType` when available. */
  googlePrimaryType?: string;
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
  /** How amplified the narrative feels on social (0–100). */
  hypeScore: number;
}

/** What the user appears to be optimizing for, inferred from the search string only. */
export type UserIntentKind =
  | "study_work"
  | "low_wait"
  | "date_night"
  | "budget_celebration"
  | "budget_eats"
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
  /** Query tokens or phrases that supported the classification (illustrative). */
  matchedSignals: string[];
}

/** How the search string was read for scoring and copy (V2.5). */
export type QueryMode = "goal_search" | "specific_place" | "place_with_intent";

export interface VibeGapScore {
  /**
   * Social hype vs. review-reality mismatch (0 = aligned, 100 = strong conflict).
   * Does not measure whether the venue fits the user’s goal — see intentFitScore.
   */
  vibeGapScore: number;
  /**
   * How well the modeled venue matches the user’s inferred goal (0 = poor fit, 100 = strong fit).
   * Independent of whether social disagrees with reviews.
   */
  intentFitScore: number;
  intentFitVerdict: string;
  /** How “touristy” or crowded-tourist patterns feel from reviews (0–100). */
  touristDensityScore: number;
  /** Likelihood of long waits / lines (0–100). */
  waitRiskScore: number;
  /** Whether reviews support laptop / work-friendly visits (0–100). */
  laptopFriendlyScore: number;
  /** Higher = stronger mismatch between budget-friendly social framing and review price/value cues (0–100). */
  priceRealityScore: number;
  /** One-line read of the VibeGap (social vs. reviews only). */
  verdict: string;
  hypeIndex: number;
  realityIndex: number;
  /** Evidence for VibeGap Score — social narrative vs. review narrative. */
  vibeGapExplanationBullets: string[];
  /** Evidence for Intent Fit — user goal vs. what reviews + posts imply you will get. */
  intentFitExplanationBullets: string[];
}

/** When a Google Places attempt did not yield live place data (mock fallback or not applicable). */
export type GooglePlacesFallbackKind = "none" | "no_confident_match" | "lookup_unavailable";

/** How the quick verdict / recommendation copy was produced (scores always rule-based). */
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
  /** One-paragraph read of what social is selling. */
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
  /** How the quick verdict / recommendation copy was produced (scores always rule-based). */
  narrativeSource: NarrativeSource;
  /** True when an LLM successfully supplied polished copy merged into this report. */
  aiNarrativeUsed: boolean;
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

export interface CompareResult {
  searchQueryDisplay: string;
  detectedIntent: DetectedIntent;
  goalDisplay: string;
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

export type VibecheckResponse =
  | {
      mode: "single_report";
      report: VibeReport;
    }
  | {
      mode: "compare";
      compare: CompareResult;
      sourceLabel: "Uses Google Places and available review signals. Social comparison is illustrative.";
    }
  | {
      mode: "recommendations";
      detectedIntent: DetectedIntent;
      locationCandidate: string;
      /** When set, UI title uses “near [name]” instead of “in [locationCandidate]”. */
      nearAnchorName?: string | null;
      /** Short note when a landmark/area was used as the geographic anchor for nearby picks. */
      anchorNote?: string | null;
      candidates: RankedCandidate[];
      sourceLabel: string;
      recoveryMessage: null;
    }
  | {
      mode: "needs_location";
      detectedIntentLabel: string;
      locationCandidate: null;
      candidates: [];
      sourceLabel: "Uses Google Places and available review signals. Social comparison is illustrative.";
      recoveryMessage: string;
    };
