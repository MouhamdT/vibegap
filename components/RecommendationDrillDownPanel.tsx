"use client";

import { useState } from "react";
import { ReviewEvidencePanel } from "@/components/ReviewEvidencePanel";
import { formatFitScoreTen } from "@/lib/format/fitScoreTen";
import type { RankedCandidate, RecommendationGeography } from "@/lib/types/vibecheck";

export type RecommendationDrillDownPanelProps = {
  candidate: RankedCandidate;
  rank: number;
  onClose?: () => void;
  variant: "inline" | "sidebar";
  geography?: RecommendationGeography | null;
  onSuggestRefinement?: (refinement: string) => void;
};

function decisionPillClass(label: RankedCandidate["decision"]["label"]) {
  if (label === "GO") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-950";
  if (label === "SKIP") return "border-rose-200/70 bg-rose-50/55 text-rose-950";
  return "border-amber-200/70 bg-amber-50/55 text-amber-950";
}

const SUGGEST_CHIPS: { label: string; refinement: string }[] = [
  { label: "Quieter", refinement: "quieter" },
  { label: "Less wait", refinement: "less wait" },
  { label: "Better value", refinement: "cheaper" },
];

export function RecommendationDrillDownPanel({
  candidate: c,
  rank,
  onClose,
  variant,
  onSuggestRefinement,
}: RecommendationDrillDownPanelProps) {
  const [suggestOpen, setSuggestOpen] = useState(false);

  const shell =
    variant === "sidebar"
      ? "rounded-lg border border-stone-200/70 bg-[#faf9f7] p-3.5 sm:p-4"
      : "border-t border-stone-200/80 bg-[#faf9f7] px-3 pb-3 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4";

  return (
    <section className={shell} aria-labelledby={`place-${c.place.id}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`place-${c.place.id}-heading`} className="text-base font-semibold tracking-tight text-stone-950 sm:text-lg">
          {c.place.name}
        </h2>
        {variant === "inline" && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Close
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-stone-600">{c.place.address}</p>
      <p className="mt-0.5 text-[11px] text-stone-500">
        <span className="font-medium text-stone-800">{c.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
        {c.place.reviewCount.toLocaleString()} reviews ·{" "}
        <span className="font-medium text-stone-800">{"$".repeat(c.place.priceLevel)}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold tabular-nums tracking-tight text-stone-950">
          {formatFitScoreTen(c.fitScore)}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${decisionPillClass(c.decision.label)}`}
        >
          {c.decision.label}
        </span>
      </div>

      <dl className="mt-3 space-y-2 text-[11px] leading-snug text-stone-600">
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-stone-700">Main risk</dt>
          <dd className="text-stone-600">{c.mainRisk}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-stone-700">Best for</dt>
          <dd className="text-stone-600">{c.bestFor}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-stone-700">Why #{rank}</dt>
          <dd className="text-stone-600">{c.rankReason}</dd>
        </div>
      </dl>

      {onSuggestRefinement ? (
        <div className="mt-3">
          {suggestOpen ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {SUGGEST_CHIPS.map((chip) => (
                <button
                  key={chip.refinement}
                  type="button"
                  onClick={() => {
                    onSuggestRefinement(chip.refinement);
                    setSuggestOpen(false);
                  }}
                  className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSuggestOpen(false)}
                className="px-1 text-[10px] font-medium text-stone-400 transition hover:text-stone-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSuggestOpen(true)}
              className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
            >
              Suggest something else
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-3 min-w-0">
        <ReviewEvidencePanel place={c.place} variant="compact" showDataHonesty={false} scoreBreakdown={c.scoreBreakdown} />
      </div>
    </section>
  );
}
