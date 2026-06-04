import type { QueryMode, UserIntentKind } from "@/lib/types/vibecheck";

/** Primary score card label: goal-aware named-venue + goal vs. general signal gap. */
export function signalGapScoreLabel(queryMode: QueryMode): "Goal mismatch" | "Signal gap" {
  return queryMode === "place_with_intent" ? "Goal mismatch" : "Signal gap";
}

/** Short caption under the score when space allows (single venue report). */
export function signalGapScoreCaption(queryMode: QueryMode, intentKind?: UserIntentKind): string {
  if (intentKind === "venue_lookup") {
    return "Light read without a parsed visit goal — add a goal for a sharper match.";
  }
  if (queryMode === "place_with_intent") {
    return "How strongly venue and review signals conflict with your stated visit goal.";
  }
  return "No specific visit goal in your search — light read of scoring cues against review themes; add a goal for fit scoring.";
}

export function signalGapRationaleHeading(queryMode: QueryMode): string {
  return queryMode === "place_with_intent" ? "Goal mismatch rationale" : "Signal gap rationale";
}
