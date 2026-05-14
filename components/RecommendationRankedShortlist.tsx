"use client";

import { useEffect, useRef } from "react";
import { RecommendationDrillDownPanel } from "@/components/RecommendationDrillDownPanel";
import type { RankedCandidate } from "@/lib/types/vibecheck";

export type RecommendationRankedShortlistProps = {
  candidates: RankedCandidate[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  /** When true, detail renders in a desktop sidebar — no inline panel in rows. */
  desktopSplit: boolean;
};

function decisionTone(label: RankedCandidate["decision"]["label"]) {
  if (label === "GO") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-950";
  if (label === "SKIP") return "border-rose-200/70 bg-rose-50/55 text-rose-950";
  return "border-amber-200/70 bg-amber-50/55 text-amber-950";
}

function rowActivate(placeId: string, desktopSplit: boolean, isSelected: boolean, onSelectPlace: (id: string | null) => void) {
  if (desktopSplit) {
    onSelectPlace(placeId);
    return;
  }
  onSelectPlace(isSelected ? null : placeId);
}

export function RecommendationRankedShortlist({
  candidates,
  selectedPlaceId,
  onSelectPlace,
  desktopSplit,
}: RecommendationRankedShortlistProps) {
  const inlinePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedPlaceId || desktopSplit) return;
    inlinePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedPlaceId, desktopSplit]);

  return (
    <div className="space-y-1" role="list" aria-label="Ranked recommendations">
      {candidates.map((c, idx) => {
        const rank = idx + 1;
        const isSelected = selectedPlaceId === c.place.id;
        const showInlinePanel = !desktopSplit && isSelected;

        return (
          <div
            key={c.place.id}
            role="listitem"
            className={`overflow-hidden rounded-lg border transition-colors ${
              isSelected
                ? "border-stone-400/70 bg-stone-50/90 pl-0 shadow-none ring-1 ring-stone-200/40"
                : "border-stone-200/70 bg-white hover:border-stone-300 hover:bg-stone-50/50"
            }`}
          >
            <button
              type="button"
              aria-expanded={desktopSplit ? isSelected : showInlinePanel}
              onClick={() => rowActivate(c.place.id, desktopSplit, isSelected, onSelectPlace)}
              className={`group relative w-full cursor-pointer rounded-lg text-left outline-none transition-colors select-text focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f4] ${
                isSelected
                  ? "border-l-[3px] border-l-stone-800 pl-[calc(0.75rem-3px)] sm:pl-[calc(0.875rem-3px)]"
                  : "border-l-[3px] border-l-transparent pl-3 sm:pl-3.5"
              } px-3 py-2.5 sm:px-3.5 sm:py-2.5`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pr-[4.5rem] sm:pr-24">
                <span className="text-[11px] font-medium tabular-nums text-stone-400">#{rank}</span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${decisionTone(c.decision.label)}`}
                >
                  {c.decision.label}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-stone-950">{c.place.name}</span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                <span className="font-medium text-stone-800">{c.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
                {c.place.reviewCount.toLocaleString()} reviews ·{" "}
                <span className="font-medium text-stone-800">{"$".repeat(c.place.priceLevel)}</span>
                <span className="text-stone-300"> · </span>
                Fit {c.fitScore}
                <span className="text-stone-300"> · </span>
                {c.decision.confidence} confidence
              </p>
              <p className="mt-1.5 text-[12px] leading-snug text-stone-700">{c.oneSentenceReason}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
                <span className="font-medium text-stone-600">Driver:</span> {c.scoreDriver}
                <span className="text-stone-300"> · </span>
                <span className="font-medium text-stone-600">Best for:</span> {c.bestFor}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                <span className="font-medium text-stone-600">Risk:</span> {c.mainRisk}
              </p>
              <span className="pointer-events-none absolute right-3 top-3 text-[11px] font-medium text-stone-500 underline-offset-2 group-hover:text-stone-800 group-hover:underline sm:right-3.5 sm:top-3.5">
                {desktopSplit ? "Details" : isSelected ? "Hide" : "Details"}
              </span>
            </button>

            {showInlinePanel ? (
              <div ref={inlinePanelRef}>
                <RecommendationDrillDownPanel
                  candidate={c}
                  rank={rank}
                  variant="inline"
                  onClose={() => onSelectPlace(null)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
