"use client";

import { ReviewEvidencePanel } from "@/components/ReviewEvidencePanel";
import { selectedVenueGeographyLine } from "@/lib/format/geographyUi";
import { REVIEW_EVIDENCE_HONESTY } from "@/lib/copy/productHonesty";
import type { RankedCandidate, RecommendationGeography } from "@/lib/types/vibecheck";

export type RecommendationDrillDownPanelProps = {
  candidate: RankedCandidate;
  rank: number;
  onClose?: () => void;
  variant: "inline" | "sidebar";
  geography?: RecommendationGeography | null;
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
  onClose,
  variant,
  geography,
}: RecommendationDrillDownPanelProps) {
  const shell =
    variant === "sidebar"
      ? "rounded-lg border border-stone-200/70 bg-[#faf9f7] p-3.5 sm:p-4"
      : "border-t border-stone-200/80 bg-[#faf9f7] px-3 pb-3 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4";

  const breakdownRows = c.scoreBreakdown.filter(
    (row) => isMeaningfulScore(row.score) && row.label.trim().length > 0,
  );

  const showFitScore = isMeaningfulScore(c.fitScore);
  const geoLine = selectedVenueGeographyLine(c, geography);

  return (
    <section className={shell} aria-labelledby={`place-${c.place.id}-heading`}>
      {/* A. Venue header */}
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
      {geoLine ? (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-[11px] font-medium leading-snug text-stone-700">{geoLine}</p>
          {geography?.hasApproximateDistances && typeof c.distanceFromAnchorMeters === "number" ? (
            <p className="text-[9px] leading-snug text-stone-400">Distances are approximate.</p>
          ) : null}
        </div>
      ) : null}

      {c.shortlistRole ? (
        <div className="mt-3 rounded-md border border-stone-100 bg-white/80 px-3 py-2">
          <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-stone-400">Why this role</p>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-700">
            {c.shortlistRole === "Best overall" &&
              "Strongest combined fit in this shortlist after intent filtering, review signals, and your current style and tuning."}
            {c.shortlistRole === "Safest choice" && "Higher confidence in available Google review signals versus peers at similar fit."}
            {c.shortlistRole === "Closest to anchor" &&
              (geography?.nearAnchorDisplayName
                ? `Shortest approximate distance from ${geography.nearAnchorDisplayName} among ranked picks — distance does not override goal fit.`
                : "Shortest approximate distance to your anchor among ranked picks — distance does not replace goal fit.")}
            {c.shortlistRole === "Best value" && "Relatively lighter price level or stronger value cues in this batch for a budget-minded plan."}
            {c.shortlistRole === "Fresh pick" &&
              "Less review volume than the biggest names here, but still aligned with your plan in the current signals."}
            {!["Best overall", "Safest choice", "Closest to anchor", "Best value", "Fresh pick"].includes(c.shortlistRole ?? "") &&
              "This label highlights a useful angle on the same ranked set."}
          </p>
        </div>
      ) : null}

      {/* B. Decision summary */}
      <div className="mt-3 rounded-lg bg-white/90 px-3 py-2.5 ring-1 ring-stone-200/50">
        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-stone-400">Decision</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${decisionPillClass(c.decision.label)}`}
          >
            {c.decision.label}
          </span>
          <span className="text-[11px] text-stone-600">{c.decision.confidence} confidence</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-stone-800">{c.decisionToneLine}</p>
      </div>

      {/* C. Key decision facts */}
      <dl className="mt-3 space-y-2 text-[11px] leading-snug text-stone-600">
        {showFitScore ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 font-medium text-stone-700">Fit score</dt>
            <dd className="min-w-0 text-right text-lg font-semibold tabular-nums text-stone-950">{Math.round(c.fitScore)}</dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-stone-700">Main risk</dt>
          <dd className="text-stone-600">{c.mainRisk}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-stone-700">Best for</dt>
          <dd className="text-stone-600">{c.bestFor}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-stone-700">Why ranked #{rank}</dt>
          <dd className="text-stone-600">{c.rankReason}</dd>
        </div>
        {c.geographySignalLine ? (
          <div className="flex flex-col gap-0.5">
            <dt className="font-medium text-stone-700">Location note</dt>
            <dd className="text-[11px] leading-snug text-stone-500">{c.geographySignalLine}</dd>
          </div>
        ) : null}
      </dl>

      {/* D. Review evidence (collapsed by default; honesty once at panel footer) */}
      <div className="mt-3 min-w-0">
        <ReviewEvidencePanel place={c.place} showDataHonesty={false} />
      </div>

      {/* E. Score breakdown */}
      {breakdownRows.length > 0 ? (
        <details className="group mt-3 rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-stone-200/40">
          <summary className="cursor-pointer list-none text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              <span>Score breakdown</span>
              <span className="font-normal normal-case tracking-normal text-stone-400 group-open:hidden">Open</span>
            </span>
          </summary>
          <div className="mt-2 space-y-0 divide-y divide-stone-100 border-t border-stone-100 pt-2">
            {breakdownRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 py-2 first:pt-0">
                <div className="flex items-center justify-between gap-2 text-[10px] text-stone-600">
                  <span className="min-w-0 truncate font-medium text-stone-800">{row.label}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-stone-900">{Math.round(row.score)}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-stone-500">{row.explanation}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <p className="mt-3 text-[9px] leading-snug text-stone-400">{REVIEW_EVIDENCE_HONESTY}</p>
    </section>
  );
}
