import type { QueryMode } from "@/lib/types/vibecheck";

/** Primary score card label: goal-aware named-venue + goal vs. general signal gap. */
export function signalGapScoreLabel(queryMode: QueryMode): "Goal mismatch" | "Signal gap" {
  return queryMode === "place_with_intent" ? "Goal mismatch" : "Signal gap";
}

/** Short caption under the score when space allows (single-place report). */
export function signalGapScoreCaption(queryMode: QueryMode): string {
  if (queryMode === "place_with_intent") {
    return "How strongly review/venue signals conflict with the stated visit goal.";
  }
  return "No specific goal detected; this is based on general venue framing vs. review-backed cues.";
}

export function signalGapRationaleHeading(queryMode: QueryMode): string {
  return queryMode === "place_with_intent" ? "Goal mismatch rationale" : "Signal gap rationale";
}
