import { getMockPlaceForQuery } from "@/lib/places/mockPlacesProvider";
import { getMockSocialForPlace } from "@/lib/social/mockSocialProvider";
import type { VibeGapScore, VibeReport } from "@/lib/types/vibecheck";

/**
 * Deterministic mock “truth” layer — compares placeholder hype vs. review copy.
 * Replace with real scoring when APIs are wired.
 */
export function buildMockVibeReport(searchQuery: string): VibeReport {
  const place = getMockPlaceForQuery(searchQuery);
  const socialHighlights = getMockSocialForPlace(place.id);

  const hypeIndex = Math.round(
    socialHighlights.reduce((acc, p) => acc + p.hypeScore, 0) /
      Math.max(socialHighlights.length, 1),
  );

  const realitySummary =
    "Reviews describe long weekend waits, a loud dining room, and prices above neighborhood averages. Recent feedback still praises the pasta but calls out inconsistent pacing and noise.";

  const realityIndex = 62;
  const gapMagnitude = clamp(Math.abs(hypeIndex - realityIndex) + 12, 0, 100);

  const score: VibeGapScore = {
    gapMagnitude,
    verdict:
      gapMagnitude > 55
        ? "Social story and review reality diverge"
        : "Mostly in the same ballpark",
    hypeIndex,
    realityIndex,
  };

  return {
    place,
    socialHighlights,
    realitySummary,
    score,
    generatedAt: new Date().toISOString(),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
