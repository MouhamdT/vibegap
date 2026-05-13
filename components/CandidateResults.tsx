import { CandidateComparisonTable } from "@/components/CandidateComparisonTable";
import { CandidateCard } from "@/components/CandidateCard";
import { RecommendationInsights } from "@/components/RecommendationInsights";
import { buildRecommendationInsights } from "@/lib/ai/recommendationInsights";
import type { DetectedIntent } from "@/lib/types/vibecheck";
import type { RankedCandidate } from "@/lib/types/vibecheck";

type CandidateResultsProps = {
  detectedIntent: DetectedIntent;
  locationCandidate: string;
  candidates: RankedCandidate[];
  sourceLabel: string;
};

export function CandidateResults({
  detectedIntent,
  locationCandidate,
  candidates,
  sourceLabel,
}: CandidateResultsProps) {
  const insights = buildRecommendationInsights(candidates, detectedIntent, locationCandidate);
  return (
    <section className="space-y-5" aria-label="Recommended places">
      <header className="space-y-2 border-b border-stone-100 pb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Recommendation mode</p>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
          Best matches for {detectedIntent.label.toLowerCase()} in {locationCandidate}
        </h2>
        <p className="text-xs text-stone-500">{sourceLabel}</p>
      </header>
      <RecommendationInsights insights={insights} />
      <CandidateComparisonTable candidates={candidates} />
      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center">
          <p className="text-sm text-stone-700">
            No strong candidates were returned for this search. Try a nearby neighborhood or slightly broader wording.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {candidates.map((c, idx) => (
            <CandidateCard key={c.place.id} candidate={c} rank={idx + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
