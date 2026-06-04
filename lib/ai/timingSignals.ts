import type { DetectedIntent, PlaceData } from "@/lib/types/vibecheck";

/** Listing-based timing hints — not live crowd or wait forecasts. */
export function buildTimingContextLines(place: PlaceData, intent: DetectedIntent): string[] {
  const lines: string[] = [];
  const hours = place.weekdayHoursSummary?.trim();
  if (hours) {
    lines.push(`Listed hours include: ${hours}. This reflects the venue listing, not how busy it is right now.`);
  }
  if (intent.kind === "low_wait" && !hours) {
    lines.push(
      "Wait risk here comes from review themes only — we do not have live queue data. Off-peak visits usually reduce surprises.",
    );
  }
  if ((intent.kind === "study_work" || intent.kind === "quiet_calm") && hours) {
    lines.push("For study-style visits, compare listed opening hours with when reviews mention noise or crowding.");
  }
  return lines;
}
