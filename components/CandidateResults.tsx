"use client";

import { useMemo, useState } from "react";
import { PriorityTuningPanel } from "@/components/PriorityTuningPanel";
import { RecommendationDrillDownPanel } from "@/components/RecommendationDrillDownPanel";
import { RecommendationInsights } from "@/components/RecommendationInsights";
import { RecommendationRankedShortlist } from "@/components/RecommendationRankedShortlist";
import { buildRecommendationInsights } from "@/lib/ai/recommendationInsights";
import {
  applyPriorityWeightsToCandidates,
  getDefaultPriorityWeights,
  weightsEqual,
  type PriorityWeights,
} from "@/lib/ai/priorityTuning";
import { assignGeographySignalLines } from "@/lib/geo/enrichRecommendationGeography";
import { useMinWidthLg } from "@/lib/hooks/useMinWidthLg";
import type { DetectedIntent, RankedCandidate, RecommendationGeography } from "@/lib/types/vibecheck";

type CandidateResultsProps = {
  detectedIntent: DetectedIntent;
  locationCandidate: string;
  candidates: RankedCandidate[];
  nearAnchorName?: string | null;
  anchorNote?: string | null;
  geography?: RecommendationGeography | null;
};

export function CandidateResults(props: CandidateResultsProps) {
  const resetKey = `${props.detectedIntent.kind}|${props.candidates.map((c) => c.place.id).join("\u001f")}`;
  return <CandidateResultsBody key={resetKey} {...props} />;
}

function CandidateResultsBody({
  detectedIntent,
  locationCandidate,
  candidates,
  nearAnchorName,
  anchorNote,
  geography,
}: CandidateResultsProps) {
  const defaultWeights = useMemo(() => getDefaultPriorityWeights(detectedIntent), [detectedIntent]);
  const [weights, setWeights] = useState<PriorityWeights>(defaultWeights);
  const [userAdjusted, setUserAdjusted] = useState(false);

  const rankedCandidates = useMemo(() => {
    const base = weightsEqual(weights, defaultWeights) ? candidates : applyPriorityWeightsToCandidates(candidates, weights);
    return assignGeographySignalLines(base, geography?.nearAnchorDisplayName ?? null);
  }, [candidates, weights, defaultWeights, geography?.nearAnchorDisplayName]);

  const insights = buildRecommendationInsights(rankedCandidates, detectedIntent, locationCandidate);
  const isDesktop = useMinWidthLg();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(() => candidates[0]?.place.id ?? null);

  const activeSelectedId = rankedCandidates.some((c) => c.place.id === selectedPlaceId)
    ? selectedPlaceId
    : (rankedCandidates[0]?.place.id ?? null);

  const handleWeightsChange = (next: PriorityWeights) => {
    const merged = { ...next, atmosphere: defaultWeights.atmosphere };
    if (weightsEqual(merged, weights)) return;
    const nextRanked = weightsEqual(merged, defaultWeights)
      ? candidates
      : applyPriorityWeightsToCandidates(candidates, merged);
    setUserAdjusted(true);
    setWeights(merged);
    setSelectedPlaceId(nextRanked[0]?.place.id ?? null);
  };

  const handleReset = () => {
    setWeights(defaultWeights);
    setUserAdjusted(false);
    setSelectedPlaceId(candidates[0]?.place.id ?? null);
  };

  const selectedCandidate = rankedCandidates.find((c) => c.place.id === activeSelectedId) ?? null;
  const selectedRank = selectedCandidate ? rankedCandidates.indexOf(selectedCandidate) + 1 : 0;

  return (
    <section className="space-y-3" aria-label="Recommended places">
      <header className="border-b border-stone-200/50 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">Recommendation mode</p>
            <h2 className="text-balance text-lg font-semibold tracking-tight text-stone-950 sm:text-xl">
              Best matches for {detectedIntent.label}
              {nearAnchorName ? ` near ${nearAnchorName}` : ` in ${locationCandidate}`}
            </h2>
            {anchorNote ? (
              <p className="max-w-2xl text-[11px] font-medium leading-relaxed text-stone-600">{anchorNote}</p>
            ) : null}
          </div>
          {rankedCandidates.length > 0 ? (
            <PriorityTuningPanel
              weights={weights}
              defaultWeights={defaultWeights}
              onWeightsChange={handleWeightsChange}
              onReset={handleReset}
              rankingNote={userAdjusted ? "Ranking updated locally." : null}
              prioritiesSubLabel={userAdjusted ? "Custom priorities" : "Detected priorities"}
            />
          ) : null}
        </div>
      </header>

      <RecommendationInsights insights={insights} />

      {rankedCandidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200/80 bg-[#faf9f7] px-4 py-8 text-left sm:px-6 sm:py-9">
          <p className="text-sm font-medium leading-relaxed text-stone-800">
            I couldn&apos;t find a confident match. Try adding a city, neighborhood, or landmark.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-stone-600">Examples:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[12px] leading-relaxed text-stone-600">
            <li>brunch near Trevi Fountain</li>
            <li>quiet cafe in Copenhagen</li>
            <li>cheap birthday dinner London</li>
          </ul>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Ranked shortlist</p>
              {geography?.hasApproximateDistances ? (
                <p className="text-[9px] leading-snug text-stone-400">Distances are approximate.</p>
              ) : null}
            </div>
            <RecommendationRankedShortlist
              candidates={rankedCandidates}
              selectedPlaceId={activeSelectedId}
              onSelectPlace={setSelectedPlaceId}
              desktopSplit={isDesktop}
              geography={geography}
            />
          </div>

          {isDesktop && selectedCandidate ? (
            <aside
              className="min-w-0 lg:mt-0 lg:max-h-[min(calc(100vh-5rem),56rem)] lg:overflow-y-auto lg:self-start lg:pr-0.5"
              aria-label="Selected place analysis"
            >
              <RecommendationDrillDownPanel
                candidate={selectedCandidate}
                rank={selectedRank}
                variant="sidebar"
                geography={geography}
              />
            </aside>
          ) : null}
        </div>
      )}
    </section>
  );
}
