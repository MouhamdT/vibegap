import type { ComparePlaceSide, CompareTuningFamily } from "@/lib/types/vibecheck";

function stripTrailingPeriod(s: string): string {
  return s.replace(/\.$/, "");
}

function goalFactorPhrase(family: CompareTuningFamily): string {
  switch (family) {
    case "study":
      return "quiet fit, seating and laptop-friendly cues, and review confidence";
    case "low_wait":
      return "wait behavior, reservation friction, timing flexibility, and review confidence";
    case "budget":
      return "value, price risk, group practicality, and review confidence";
    case "occasion":
      return "occasion fit, atmosphere cues, reservation risk, and review confidence";
    case "food":
      return "food fit, meal relevance, value, and review confidence";
  }
}

/** No parsed user goal — general two-venue read only. */
export function buildNoGoalCompareVerdict(
  winner: ComparePlaceSide,
  other: ComparePlaceSide,
): { whyWinner: string; tradeoff: string; chooseWinnerIf: string; chooseOtherIf: string } {
  const whyWinner =
    "General comparison based on available venue and review signals. Add a goal for a stronger decision.";
  const tradeoff = `Both venues have tradeoffs in the signals we could read — compare ${winner.place.name} and ${other.place.name} on the review themes that matter most to you.`;
  const chooseWinnerIf = `Choose ${winner.place.name} if its review pattern matches what you want from a general visit.`;
  const chooseOtherIf = `Choose ${other.place.name} if ${stripTrailingPeriod(other.bestFor.toLowerCase())} lines up better with your priorities.`;

  return { whyWinner, tradeoff, chooseWinnerIf, chooseOtherIf };
}

/** Parsed goal present but not mapped to a tuning family (no sliders). */
export function buildUnmappedGoalCompareVerdict(
  winner: ComparePlaceSide,
  other: ComparePlaceSide,
  goalDisplay: string,
): { whyWinner: string; tradeoff: string; chooseWinnerIf: string; chooseOtherIf: string } {
  const whyWinner = `A tentative read for ${goalDisplay}: ${winner.place.name} leads on aggregate intent fit from available review signals (rule-based). Rephrase with brunch, study, low wait, budget, or occasion wording to unlock comparison tuning.`;
  const tradeoff = `Choose ${other.place.name} if ${stripTrailingPeriod(other.bestFor.toLowerCase())} matters more than ${stripTrailingPeriod(winner.mainRisk.toLowerCase())} for this goal.`;
  const chooseWinnerIf = `Choose ${winner.place.name} if you want the stronger aggregate fit for ${goalDisplay} and can accept: ${stripTrailingPeriod(winner.mainRisk.toLowerCase())}.`;
  const chooseOtherIf = `Choose ${other.place.name} if ${stripTrailingPeriod(other.bestFor.toLowerCase())} outweighs ${stripTrailingPeriod(other.mainRisk.toLowerCase())}.`;

  return { whyWinner, tradeoff, chooseWinnerIf, chooseOtherIf };
}

/** Goal-specific compare — initial (default weights). */
export function buildGoalCompareInitialVerdict(
  winner: ComparePlaceSide,
  other: ComparePlaceSide,
  goalDisplay: string,
  family: CompareTuningFamily,
): { whyWinner: string; tradeoff: string; chooseWinnerIf: string; chooseOtherIf: string } {
  const factors = goalFactorPhrase(family);
  const whyWinner = `Recommended for ${goalDisplay} based on ${factors} (goal-weighted, rule-based scores from available review signals).`;
  const tradeoff = `Choose ${other.place.name} if ${stripTrailingPeriod(other.bestFor.toLowerCase())} matters more than ${stripTrailingPeriod(winner.mainRisk.toLowerCase())}.`;
  const chooseWinnerIf = `Choose ${winner.place.name} if you want the safer fit for ${goalDisplay} and can accept: ${stripTrailingPeriod(winner.mainRisk.toLowerCase())}.`;
  const chooseOtherIf = `Choose ${other.place.name} if ${stripTrailingPeriod(other.bestFor.toLowerCase())} outweighs ${stripTrailingPeriod(other.mainRisk.toLowerCase())}.`;

  return { whyWinner, tradeoff, chooseWinnerIf, chooseOtherIf };
}

/** After user moves compare tuning sliders locally. */
export function buildGoalComparePostTuneVerdict(
  winner: ComparePlaceSide,
  other: ComparePlaceSide,
  goalDisplay: string,
  family: CompareTuningFamily,
): { whyWinner: string; tradeoff: string; chooseWinnerIf: string; chooseOtherIf: string } {
  const base = buildGoalCompareInitialVerdict(winner, other, goalDisplay, family);
  return {
    ...base,
    whyWinner: `${base.whyWinner} Your tune shifted weights locally between the two venues (still rule-based, same review signals).`,
  };
}
