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
import { applyRecommendationStyleRescore, type RecommendationStyleMode } from "@/lib/ai/recommendationStyleRank";
import { assignShortlistRoles } from "@/lib/ai/shortlistRoles";
import { DecisionMapEntry } from "@/components/DecisionMapEntry";
import { assignGeographySignalLines } from "@/lib/geo/enrichRecommendationGeography";
import { useMinWidthLg } from "@/lib/hooks/useMinWidthLg";
import { formatRecommendationMapFooter } from "@/lib/maps/formatRecommendationMapFooter";
import { recommendationMapCanRender, recommendationMapPins } from "@/lib/maps/decisionMapModel";
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
  const [recStyle, setRecStyle] = useState<RecommendationStyleMode>("balanced");

  const rankedCandidates = useMemo(() => {
    const base = weightsEqual(weights, defaultWeights)
      ? candidates
      : applyPriorityWeightsToCandidates(candidates, weights);
    const styled = applyRecommendationStyleRescore(base, recStyle);
    const withGeo = assignGeographySignalLines(styled, geography?.nearAnchorDisplayName ?? null);
    return assignShortlistRoles(withGeo, detectedIntent, geography, recStyle);
  }, [candidates, weights, defaultWeights, recStyle, geography, detectedIntent]);

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
    const reordered = applyRecommendationStyleRescore(nextRanked, recStyle);
    setSelectedPlaceId(reordered[0]?.place.id ?? null);
  };

  const handleReset = () => {
    setWeights(defaultWeights);
    setUserAdjusted(false);
    setSelectedPlaceId(candidates[0]?.place.id ?? null);
  };

  const styleBlurb =
    recStyle === "reliable"
      ? "Prioritizing established places with stronger review coverage and lower risk."
      : recStyle === "discovery"
        ? "Allowing less obvious places when they strongly match the plan."
        : "Balancing intent fit, review confidence, and practical tradeoffs.";

  const selectedCandidate = rankedCandidates.find((c) => c.place.id === activeSelectedId) ?? null;
  const selectedRank = selectedCandidate ? rankedCandidates.indexOf(selectedCandidate) + 1 : 0;

  const decisionMapPins = useMemo(
    () => recommendationMapPins(rankedCandidates, activeSelectedId, geography),
    [rankedCandidates, activeSelectedId, geography],
  );

  const decisionMapCanRender = useMemo(
    () => recommendationMapCanRender(rankedCandidates, geography),
    [rankedCandidates, geography],
  );

  const decisionMapSubtitle = useMemo(() => {
    const anchorLabel = nearAnchorName || geography?.nearAnchorDisplayName;
    if (typeof anchorLabel === "string" && anchorLabel.trim()) {
      return `Near ${anchorLabel.trim()}`;
    }
    return "Ranked venues and location context.";
  }, [nearAnchorName, geography?.nearAnchorDisplayName]);

  const decisionMapFooter = selectedCandidate
    ? formatRecommendationMapFooter(selectedCandidate, selectedRank, geography)
    : null;

  return (
    <section className="space-y-3" aria-label="Recommended places">
      <header className="border-b border-stone-200/50 pb-3">
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-8 lg:gap-y-0">
          <div className="min-w-0 max-w-full space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">Recommendation mode</p>
            <h2 className="max-w-full text-pretty text-lg font-semibold tracking-tight text-stone-950 sm:text-xl">
              Best matches for {detectedIntent.label}
              {nearAnchorName ? ` near ${nearAnchorName}` : ` in ${locationCandidate}`}
            </h2>
            {anchorNote ? (
              <p className="max-w-2xl text-[11px] font-medium leading-relaxed text-stone-600">{anchorNote}</p>
            ) : null}
            <p className="max-w-2xl text-[11px] leading-relaxed text-stone-500">{insights.confidenceNote}</p>
            <p className="max-w-2xl text-[11px] leading-relaxed text-stone-600">{styleBlurb}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Recommendation style</span>
              {(["reliable", "balanced", "discovery"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setRecStyle(mode);
                    const base = weightsEqual(weights, defaultWeights)
                      ? candidates
                      : applyPriorityWeightsToCandidates(candidates, weights);
                    const next = applyRecommendationStyleRescore(base, mode);
                    setSelectedPlaceId(next[0]?.place.id ?? null);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                    recStyle === mode
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  {mode === "reliable" ? "Reliable" : mode === "balanced" ? "Balanced" : "Discovery"}
                </button>
              ))}
            </div>
            {decisionMapCanRender ? (
              <div className="pt-1">
                <DecisionMapEntry
                  canRender={decisionMapCanRender}
                  pins={decisionMapPins}
                  title="Decision map"
                  subtitle={decisionMapSubtitle}
                  mapMode="recommendation"
                  onSelectVenueId={setSelectedPlaceId}
                  footerPrimaryLine={decisionMapFooter}
                />
              </div>
            ) : null}
          </div>
          {rankedCandidates.length > 0 ? (
            <div className="w-full shrink-0 lg:w-auto lg:max-w-[min(380px,100%)] lg:justify-self-end">
              <PriorityTuningPanel
                weights={weights}
                defaultWeights={defaultWeights}
                onWeightsChange={handleWeightsChange}
                onReset={handleReset}
                rankingNote={userAdjusted ? "Ranking updated locally." : null}
                prioritiesSubLabel={userAdjusted ? "Custom priorities" : "Detected priorities"}
              />
            </div>
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
