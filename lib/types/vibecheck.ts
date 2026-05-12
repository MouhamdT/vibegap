/**
 * Shared types for VibeGap — social hype vs. review reality.
 */

export interface PlaceData {
  id: string;
  name: string;
  address: string;
  category: string;
  /** Aggregated rating from review sources (e.g. 1–5). */
  averageRating: number;
  reviewCount: number;
}

export interface SocialPost {
  id: string;
  platform: "tiktok" | "instagram" | "x" | "other";
  excerpt: string;
  /** How amplified the narrative feels on social (0–100). */
  hypeScore: number;
  postedAt: string;
}

export interface VibeGapScore {
  /** How far apart hype and reality feel (0 = perfect match, 100 = extreme gap). */
  gapMagnitude: number;
  /** Short label for the verdict, e.g. "Mostly aligned" or "Big mismatch". */
  verdict: string;
  /** Social-side intensity (0–100). */
  hypeIndex: number;
  /** Review-side intensity (0–100). */
  realityIndex: number;
}

export interface VibeReport {
  place: PlaceData;
  socialHighlights: SocialPost[];
  /** Plain-language summary of what reviews actually say. */
  realitySummary: string;
  score: VibeGapScore;
  generatedAt: string;
}
