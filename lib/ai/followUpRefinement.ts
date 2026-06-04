import type { RankedCandidate } from "@/lib/types/vibecheck";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function reviewBlob(c: RankedCandidate): string {
  const p = c.place;
  return [...p.complaints, ...p.positives, p.recentReviewSummary, ...p.reviewThemes.map((t) => t.label)]
    .join(" ")
    .toLowerCase();
}

/**
 * Local-only re-ranking on an existing candidate pool (no extra Places calls).
 * Interprets a short follow-up phrase as soft priorities and adjusts fit scores slightly.
 */
export function applyFollowUpRefinement(candidates: RankedCandidate[], refinement: string): RankedCandidate[] {
  const t = refinement.trim().toLowerCase();
  if (!t) return candidates;

  const wantsQuiet = /\b(quiet|quieter|calm|less noise|silent|study)\b/.test(t);
  const wantsCheap = /\b(cheap|cheaper|budget|value|affordable|lower price)\b/.test(t);
  const wantsWait = /\b(less wait|no wait|shorter line|faster seating|quick)\b/.test(t);

  const adjusted = candidates.map((c) => {
    let delta = 0;
    const blob = reviewBlob(c);
    if (wantsQuiet) {
      if (/\bloud|noise|crowd|packed|busy|music\b/.test(blob)) delta -= 10;
      if (/\bquiet|calm|peaceful|study|laptop\b/.test(blob)) delta += 8;
    }
    if (wantsCheap) {
      if (c.place.priceLevel >= 4) delta -= 8;
      if (c.place.priceLevel <= 2) delta += 6;
      if (/\boverpriced|expensive|not worth\b/.test(blob)) delta -= 6;
      if (/\bvalue|affordable|cheap|worth\b/.test(blob)) delta += 6;
    }
    if (wantsWait) {
      if (/\bwait|line|queue|reservation|packed\b/.test(blob)) delta -= 10;
      if (/\bwalk-?in|no wait|quick seating|short wait\b/.test(blob)) delta += 8;
    }
    const fitScore = clamp(Math.round(c.fitScore + delta), 0, 100);
    const label: RankedCandidate["decision"]["label"] =
      fitScore >= 72 ? "GO" : fitScore >= 46 ? "MAYBE" : "SKIP";
    return {
      ...c,
      fitScore,
      decision: { ...c.decision, label },
    };
  });

  return [...adjusted].sort((a, b) => b.fitScore - a.fitScore);
}
