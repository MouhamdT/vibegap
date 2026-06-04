"use client";

import { useId, useState } from "react";
import type { RecommendationInsights as RecommendationInsightsModel } from "@/lib/types/vibecheck";

type RecommendationInsightsProps = {
  insights: RecommendationInsightsModel;
};

function formatDecisionStats(counts: RecommendationInsightsModel["decisionCounts"]): string {
  const { go, maybe, skip } = counts;
  return `${go} GO · ${maybe} MAYBE · ${skip} SKIP`;
}

export function RecommendationInsights({ insights }: RecommendationInsightsProps) {
  const [scoringOpen, setScoringOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="space-y-2">
      <section
        className="rounded-lg border border-stone-200/60 bg-[#faf9f7] px-4 py-3.5 sm:px-5 sm:py-4"
        aria-label="Recommendation summary"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-500">Recommended first</p>
        <p className="mt-1 text-base font-semibold tracking-tight text-stone-900">{insights.topPickName}</p>
        <div className="mt-2 text-[13px] leading-snug text-stone-600">
          <span className="font-medium text-stone-800">Why it won:</span> {insights.whyItWon}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-stone-600">
          <span className="font-medium text-stone-800">Main tradeoff:</span> {insights.mainTradeoff}
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-stone-600">
          <span className="font-medium text-stone-800">Best alternative if:</span> {insights.bestAlternativeIf}
        </p>
        <p className="mt-2 text-[11px] font-medium tabular-nums text-stone-600">
          <span className="text-stone-500">Stats:</span> {formatDecisionStats(insights.decisionCounts)}
        </p>
        {insights.whyNotThese.length > 0 ? (
          <div className="mt-3 border-t border-stone-100 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Why not these?</p>
            <ul className="mt-1.5 space-y-1.5 text-[11px] leading-snug text-stone-600">
              {insights.whyNotThese.map((row) => (
                <li key={row.placeName}>
                  <span className="font-medium text-stone-800">{row.placeName}</span> — {row.oneLineReason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={scoringOpen}
            aria-controls={panelId}
            onClick={() => setScoringOpen((v) => !v)}
            className="text-[11px] font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-500"
          >
            {scoringOpen ? "Hide scoring logic" : "Scoring logic"}
          </button>
        </div>
      </section>

      {scoringOpen ? (
        <section
          id={panelId}
          className="rounded-lg border border-stone-200/60 bg-white px-4 py-3 sm:px-5 sm:py-4"
          aria-label="Scoring weights"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Weights used in this run</p>
          <div className="mt-3 space-y-2">
            {insights.scoringWeights.map((w) => (
              <div key={w.label} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[10px] text-stone-600">
                  <span className="min-w-0 truncate">{w.label}</span>
                  <span className="shrink-0 tabular-nums font-medium text-stone-800">{w.weight}%</span>
                </div>
                <div className="h-0.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-emerald-600/35" style={{ width: `${w.weight}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-stone-100 pt-3 text-[10px] tabular-nums text-stone-500">{insights.decisionSummary}</p>
          <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-stone-500">
            {insights.whyRankedFirstBullets.map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
