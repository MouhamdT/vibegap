"use client";

import type { RankedCandidate } from "@/lib/types/vibecheck";

export type RecommendationDrillDownPanelProps = {
  candidate: RankedCandidate;
  rank: number;
  onClose?: () => void;
  variant: "inline" | "sidebar";
};

export function RecommendationDrillDownPanel({
  candidate: c,
  rank,
  onClose,
  variant,
}: RecommendationDrillDownPanelProps) {
  const rankLine = c.rankReason;

  const shell =
    variant === "sidebar"
      ? "rounded-lg border border-stone-200/70 bg-[#faf9f7] p-4 sm:p-5"
      : "border-t border-stone-200/80 bg-[#faf9f7] px-3 pb-4 pt-4 sm:px-4 sm:pb-5 sm:pt-5";

  return (
    <section className={shell} aria-labelledby={`place-${c.place.id}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-200/50 pb-3">
        <h2 id={`place-${c.place.id}-heading`} className="text-lg font-semibold tracking-tight text-stone-950">
          {c.place.name}
        </h2>
        {variant === "inline" && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Close details
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-stone-600">{c.place.address}</p>
      <p className="mt-1 text-[11px] text-stone-500">
        <span className="font-medium text-stone-800">{c.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
        {c.place.reviewCount.toLocaleString()} reviews · <span className="font-medium text-stone-800">{"$".repeat(c.place.priceLevel)}</span>
      </p>

      <div className="mt-4 rounded-md border border-stone-200/60 bg-white p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Decision summary</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-900">
            {c.decision.label}
          </span>
          <span className="text-[11px] text-stone-600">Confidence {c.decision.confidence}</span>
        </div>
        <p className="mt-1.5 text-[12px] font-medium leading-snug text-stone-700">{c.decisionToneLine}</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">{c.oneSentenceReason}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-stone-200/60 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Fit score</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-stone-950">{c.fitScore}</p>
        </div>
        <div className="rounded-md border border-stone-200/60 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">VibeGap score</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-stone-300">—</p>
          <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
            Headline VibeGap runs in single-place mode. Use fit and breakdown here.
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-stone-600">
        <span className="font-medium text-stone-800">Score driver:</span> {c.scoreDriver}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-stone-600">
        <span className="font-medium text-stone-800">Main risk:</span> {c.mainRisk}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-stone-600">
        <span className="font-medium text-stone-800">Best for:</span> {c.bestFor}
      </p>

      <p className="mt-2 text-[11px] leading-relaxed text-stone-600">
        <span className="font-medium text-stone-800">Why ranked #{rank}:</span> {rankLine}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-stone-600">
        <span className="font-medium text-stone-800">Avoid if:</span> {c.avoidIf}
      </p>

      <details className="mt-4 rounded-md border border-stone-200/60 bg-white px-3 py-2">
        <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">
          Score breakdown
        </summary>
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          {c.scoreBreakdown.map((row) => (
            <div key={row.label} className="rounded border border-stone-100 bg-stone-50/60 px-2 py-1.5">
              <div className="flex items-center justify-between text-[10px] text-stone-600">
                <span className="min-w-0 truncate pr-1">{row.label}</span>
                <span className="shrink-0 font-medium text-stone-900">{row.score}</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">{row.explanation}</p>
            </div>
          ))}
        </div>
      </details>

      {c.place.recentReviewSummary ? (
        <details className="mt-2 rounded-md border border-stone-200/60 bg-white px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">
            Review signal detail
          </summary>
          <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-600">
            {c.place.recentReviewSummary}
          </p>
        </details>
      ) : null}

      {c.place.positives.length > 0 || c.place.complaints.length > 0 ? (
        <details className="mt-2 rounded-md border border-stone-200/60 bg-white px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">
            Full analysis
          </summary>
          <div className="mt-3 space-y-3 border-t border-stone-100 pt-3 text-[11px] text-stone-600">
            {c.place.positives.length > 0 ? (
              <div>
                <p className="font-medium text-stone-800">Positives</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {c.place.positives.slice(0, 6).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {c.place.complaints.length > 0 ? (
              <div>
                <p className="font-medium text-stone-800">Watch-outs</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {c.place.complaints.slice(0, 6).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <button
        type="button"
        className="mt-4 rounded-md border border-stone-200/80 bg-transparent px-2.5 py-1 text-[10px] font-medium text-stone-500 transition hover:border-stone-300 hover:bg-white hover:text-stone-800"
      >
        Check full VibeGap
      </button>
    </section>
  );
}
