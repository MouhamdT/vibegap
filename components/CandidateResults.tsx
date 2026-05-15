"use client";

import { useMemo, useRef, useState } from "react";
import { PriorityTuningPanel } from "@/components/PriorityTuningPanel";
import { RecommendationDrillDownPanel } from "@/components/RecommendationDrillDownPanel";
import { RecommendationInsights } from "@/components/RecommendationInsights";
import { RecommendationRankedShortlist } from "@/components/RecommendationRankedShortlist";
import { buildRecommendationInsights } from "@/lib/ai/recommendationInsights";
import {
  applyPriorityWeightsToCandidates,
  describePriorityChange,
  getDefaultPriorityWeights,
  weightsEqual,
  type PriorityWeights,
} from "@/lib/ai/priorityTuning";
import { useMinWidthLg } from "@/lib/hooks/useMinWidthLg";
import type { DetectedIntent, RankedCandidate } from "@/lib/types/vibecheck";

type CandidateResultsProps = {
  detectedIntent: DetectedIntent;
  locationCandidate: string;
  candidates: RankedCandidate[];
  nearAnchorName?: string | null;
  anchorNote?: string | null;
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
}: CandidateResultsProps) {
  const defaultWeights = useMemo(() => getDefaultPriorityWeights(detectedIntent), [detectedIntent]);
  const [weights, setWeights] = useState<PriorityWeights>(defaultWeights);
  const lastWeightsRef = useRef<PriorityWeights>(defaultWeights);
  const [changeMessage, setChangeMessage] = useState<string | null>(null);
  const [userAdjusted, setUserAdjusted] = useState(false);

  const rankedCandidates = useMemo(() => {
    if (weightsEqual(weights, defaultWeights)) return candidates;
    return applyPriorityWeightsToCandidates(candidates, weights);
  }, [candidates, weights, defaultWeights]);

  const insights = buildRecommendationInsights(rankedCandidates, detectedIntent, locationCandidate);
  const isDesktop = useMinWidthLg();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(() => candidates[0]?.place.id ?? null);

  const activeSelectedId = rankedCandidates.some((c) => c.place.id === selectedPlaceId)
    ? selectedPlaceId
    : (rankedCandidates[0]?.place.id ?? null);

  const handleWeightsChange = (next: PriorityWeights) => {
    if (weightsEqual(next, weights)) return;
    setUserAdjusted(true);
    setChangeMessage(describePriorityChange(lastWeightsRef.current, next));
    lastWeightsRef.current = next;
    setWeights(next);
  };

  const handleReset = () => {
    setWeights(defaultWeights);
    lastWeightsRef.current = defaultWeights;
    setChangeMessage(null);
    setUserAdjusted(false);
  };

  const selectedCandidate = rankedCandidates.find((c) => c.place.id === activeSelectedId) ?? null;
  const selectedRank = selectedCandidate ? rankedCandidates.indexOf(selectedCandidate) + 1 : 0;

  return (
    <section className="space-y-3" aria-label="Recommended places">
      <header className="space-y-1.5 border-b border-stone-200/50 pb-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">Recommendation mode</p>
        <h2 className="text-balance text-lg font-semibold tracking-tight text-stone-950 sm:text-xl">
          Best matches for {detectedIntent.label}
          {nearAnchorName ? ` near ${nearAnchorName}` : ` in ${locationCandidate}`}
        </h2>
        {anchorNote ? (
          <p className="max-w-2xl text-[11px] font-medium leading-relaxed text-stone-600">{anchorNote}</p>
        ) : null}
      </header>

      <RecommendationInsights insights={insights} />

      {rankedCandidates.length > 0 ? (
        <PriorityTuningPanel
          weights={weights}
          onWeightsChange={handleWeightsChange}
          onReset={handleReset}
          changeMessage={userAdjusted ? changeMessage : null}
        />
      ) : null}

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
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Ranked shortlist</p>
            <RecommendationRankedShortlist
              candidates={rankedCandidates}
              selectedPlaceId={activeSelectedId}
              onSelectPlace={setSelectedPlaceId}
              detectedIntent={detectedIntent}
              desktopSplit={isDesktop}
            />
          </div>

          {isDesktop && selectedCandidate ? (
            <aside className="min-w-0 lg:mt-0 lg:self-start" aria-label="Selected place analysis">
              <RecommendationDrillDownPanel
                candidate={selectedCandidate}
                rank={selectedRank}
                detectedIntent={detectedIntent}
                variant="sidebar"
              />
            </aside>
          ) : null}
        </div>
      )}
    </section>
  );
}
