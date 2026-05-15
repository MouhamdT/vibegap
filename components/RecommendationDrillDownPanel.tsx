"use client";

import { ReviewRealityPanel } from "@/components/ReviewRealityPanel";
import type { DetectedIntent, RankedCandidate } from "@/lib/types/vibecheck";

export type RecommendationDrillDownPanelProps = {
  candidate: RankedCandidate;
  rank: number;
  detectedIntent: DetectedIntent;
  onClose?: () => void;
  variant: "inline" | "sidebar";
};

function isMeaningfulScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function decisionPillClass(label: RankedCandidate["decision"]["label"]) {
  if (label === "GO") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-950";
  if (label === "SKIP") return "border-rose-200/70 bg-rose-50/55 text-rose-950";
  return "border-amber-200/70 bg-amber-50/55 text-amber-950";
}

export function RecommendationDrillDownPanel({
  candidate: c,
  rank,
  detectedIntent,
  onClose,
  variant,
}: RecommendationDrillDownPanelProps) {
  const shell =
    variant === "sidebar"
      ? "rounded-lg border border-stone-200/70 bg-[#faf9f7] p-4 sm:p-5"
      : "border-t border-stone-200/80 bg-[#faf9f7] px-3 pb-4 pt-4 sm:px-4 sm:pb-5 sm:pt-5";

  const breakdownRows = c.scoreBreakdown.filter(
    (row) => isMeaningfulScore(row.score) && row.label.trim().length > 0,
  );

  const showFitScore = isMeaningfulScore(c.fitScore);

  return (
    <section className={shell} aria-labelledby={`place-${c.place.id}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`place-${c.place.id}-heading`} className="text-lg font-semibold tracking-tight text-stone-950">
          {c.place.name}
        </h2>
        {variant === "inline" && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Close
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-stone-600">{c.place.address}</p>
      <p className="mt-1 text-[11px] text-stone-500">
        <span className="font-medium text-stone-800">{c.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
        {c.place.reviewCount.toLocaleString()} reviews ·{" "}
        <span className="font-medium text-stone-800">{"$".repeat(c.place.priceLevel)}</span>
      </p>

      <div className="mt-4 rounded-md border border-stone-200/60 bg-white p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Decision summary</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${decisionPillClass(c.decision.label)}`}
          >
            {c.decision.label}
          </span>
          <span className="text-[11px] text-stone-600">{c.decision.confidence} confidence</span>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-stone-700">{c.decisionToneLine}</p>
      </div>

      {showFitScore ? (
        <div className="mt-3 inline-flex min-w-[7rem] rounded-md border border-stone-200/60 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Fit score</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-stone-950">{Math.round(c.fitScore)}</p>
          </div>
        </div>
      ) : null}

      <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-stone-600">
        <li>
          <span className="font-medium text-stone-800">Score driver:</span> {c.scoreDriver}
        </li>
        <li>
          <span className="font-medium text-stone-800">Main risk:</span> {c.mainRisk}
        </li>
        <li>
          <span className="font-medium text-stone-800">Best for:</span> {c.bestFor}
        </li>
        <li>
          <span className="font-medium text-stone-800">Why ranked #{rank}:</span> {c.rankReason}
        </li>
        <li>
          <span className="font-medium text-stone-800">Avoid if:</span> {c.avoidIf}
        </li>
      </ul>

      <div className="mt-4">
        <ReviewRealityPanel place={c.place} intent={detectedIntent} />
      </div>

      {breakdownRows.length > 0 ? (
        <details className="mt-3 rounded-md border border-stone-200/60 bg-white px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">
            Score breakdown
          </summary>
          <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
            {breakdownRows.map((row) => (
              <div key={row.label} className="rounded border border-stone-100 bg-stone-50/60 px-2 py-1.5">
                <div className="flex items-center justify-between text-[10px] text-stone-600">
                  <span className="min-w-0 truncate pr-1">{row.label}</span>
                  <span className="shrink-0 font-medium text-stone-900">{Math.round(row.score)}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">{row.explanation}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
