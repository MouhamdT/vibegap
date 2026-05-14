"use client";

import { useState } from "react";
import { RecommendationDrillDownPanel } from "@/components/RecommendationDrillDownPanel";
import { RecommendationInsights } from "@/components/RecommendationInsights";
import { RecommendationRankedShortlist } from "@/components/RecommendationRankedShortlist";
import { buildRecommendationInsights } from "@/lib/ai/recommendationInsights";
import { useMinWidthLg } from "@/lib/hooks/useMinWidthLg";
import type { DetectedIntent } from "@/lib/types/vibecheck";
import type { RankedCandidate } from "@/lib/types/vibecheck";

const HONESTY_LINE = "Uses Google Places and available review signals. Social comparison is illustrative.";

type CandidateResultsProps = {
  detectedIntent: DetectedIntent;
  locationCandidate: string;
  candidates: RankedCandidate[];
  /** When set, headline uses “near [anchor]” instead of “in [locationCandidate]”. */
  nearAnchorName?: string | null;
  anchorNote?: string | null;
};

export function CandidateResults({
  detectedIntent,
  locationCandidate,
  candidates,
  nearAnchorName,
  anchorNote,
}: CandidateResultsProps) {
  const insights = buildRecommendationInsights(candidates, detectedIntent, locationCandidate);
  const isDesktop = useMinWidthLg();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    () => candidates[0]?.place.id ?? null,
  );

  const selectedCandidate = candidates.find((c) => c.place.id === selectedPlaceId) ?? null;
  const selectedRank = selectedCandidate ? candidates.indexOf(selectedCandidate) + 1 : 0;

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
        <p className="max-w-2xl text-[11px] leading-relaxed text-stone-500">{HONESTY_LINE}</p>
      </header>

      <RecommendationInsights insights={insights} />

      {candidates.length === 0 ? (
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
              candidates={candidates}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              desktopSplit={isDesktop}
            />
          </div>

          {isDesktop && selectedCandidate ? (
            <aside
              className="sticky top-3 max-h-[min(86vh,calc(100vh-4.5rem))] min-h-[10rem] min-w-0 overflow-y-auto lg:mt-0"
              aria-label="Selected place analysis"
            >
              <RecommendationDrillDownPanel candidate={selectedCandidate} rank={selectedRank} variant="sidebar" />
            </aside>
          ) : null}
        </div>
      )}
    </section>
  );
}
