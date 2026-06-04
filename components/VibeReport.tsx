import type { VibeReport as VibeReportModel } from "@/lib/types/vibecheck";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { singlePlaceGeographyLines } from "@/lib/format/geographyUi";
import { PRODUCT_HONESTY_FULL } from "@/lib/copy/productHonesty";
import { buildSinglePlaceShareSummary } from "@/lib/format/shareSummary";
import { signalGapRationaleHeading, signalGapScoreCaption, signalGapScoreLabel } from "@/lib/format/signalGapUi";
import { ReviewEvidencePanel } from "@/components/ReviewEvidencePanel";
import { ShareSummaryButton } from "@/components/ShareSummaryButton";
import { VibeReportDecisionMap } from "@/components/VibeReportDecisionMap";
import { ScoreCard } from "@/components/ScoreCard";
import { VisualGrid } from "@/components/VisualGrid";

export type VibeReportProps = {
  report: VibeReportModel | null;
};

function TagList({ title, items, variant }: { title: string; items: string[]; variant: "best" | "avoid" }) {
  const chip =
    variant === "best"
      ? "border-emerald-200/60 bg-emerald-50/50 text-emerald-950"
      : "border-rose-200/60 bg-rose-50/50 text-rose-950";
  return (
    <div>
      <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <li key={t} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium leading-snug ${chip}`}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function decisionTone(label: VibeReportModel["decision"]["label"]) {
  if (label === "GO") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-950";
  if (label === "SKIP") return "border-rose-200/70 bg-rose-50/55 text-rose-950";
  return "border-amber-200/70 bg-amber-50/55 text-amber-950";
}

export function VibeReport({ report }: VibeReportProps) {
  if (!report) {
    return null;
  }

  const { score, detectedIntent, quickVerdict: q, decision } = report;

  const gapLabel = signalGapScoreLabel(report.queryMode);
  const gapCaption = signalGapScoreCaption(report.queryMode, report.detectedIntent.kind);
  const gapRationaleTitle = signalGapRationaleHeading(report.queryMode);

  const placeNameForRow =
    report.placeNameCandidate !== null && report.placeNameCandidate !== ""
      ? formatSearchQueryForDisplay(report.placeNameCandidate)
      : null;
  const isVenueCheck = report.detectedIntent.kind === "venue_lookup";
  const suppressOnCardCueList =
    report.place.dataSource === "google" && !report.place.hasRealGoogleReviews;
  const showPlaceGoalRow =
    report.queryMode === "place_with_intent" && placeNameForRow !== null && report.placeIntentGoalDisplay;

  return (
    <article className="space-y-3 sm:space-y-4" aria-label="VibeGap report">
      <header className="space-y-1.5 border-b border-stone-200/50 pb-2.5 sm:space-y-2 sm:pb-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">
          {isVenueCheck ? "Venue check" : "Single venue report"}
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">{report.place.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600">{report.place.address}</p>
        <p className="text-[11px] text-stone-500">
          <span className="font-medium text-stone-800">{report.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
          {report.place.reviewCount.toLocaleString()} reviews ·{" "}
          <span className="font-medium text-stone-800">{"$".repeat(report.place.priceLevel)}</span>
          {showPlaceGoalRow ? null : isVenueCheck ? (
            <span className="text-stone-400"> · No specific visit goal detected</span>
          ) : (
            <span className="text-stone-400"> · {detectedIntent.label}</span>
          )}
        </p>
        {isVenueCheck ? (
          <p className="max-w-2xl text-[11px] leading-relaxed text-stone-600">
            This report uses venue details, rating quality, and available review themes. Add a goal like &ldquo;no waiting
            time&rdquo;, &ldquo;quiet study&rdquo;, or &ldquo;birthday dinner&rdquo; for a stronger recommendation.
          </p>
        ) : null}
        {showPlaceGoalRow ? (
          <p className="text-[11px] text-stone-600">
            <span className="text-stone-500">Goal</span>{" "}
            <span className="font-medium text-stone-900">{report.placeIntentGoalDisplay}</span>
          </p>
        ) : null}
        {report.googlePlacesFallback === "no_confident_match" ? (
          <p className="max-w-2xl text-[11px] leading-relaxed text-stone-600">
            I couldn&apos;t find a confident match for that search. Try adding a city, neighborhood, or landmark.
          </p>
        ) : null}
        {report.suggestPlaceDisambiguation ? (
          <p className="max-w-2xl text-[11px] text-stone-500">Tip: add a city or neighborhood for a tighter match.</p>
        ) : null}
        {report.geography ? (
          (() => {
            const { primary, secondary } = singlePlaceGeographyLines(report.geography);
            if (!primary && !secondary) return null;
            return (
              <div className="mt-2 space-y-0.5 border-t border-stone-100/80 pt-2">
                {primary ? <p className="text-[11px] font-medium leading-snug text-stone-700">{primary}</p> : null}
                {secondary ? <p className="text-[9px] leading-snug text-stone-400">{secondary}</p> : null}
              </div>
            );
          })()
        ) : null}
        {report.timingContextLines && report.timingContextLines.length > 0 ? (
          <div className="mt-2 space-y-1 rounded-md border border-stone-100 bg-stone-50/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Hours & timing</p>
            {report.timingContextLines.map((line, i) => (
              <p key={`timing-${i}`} className="text-[11px] leading-relaxed text-stone-600">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ShareSummaryButton text={buildSinglePlaceShareSummary(report)} />
        </div>
        <VibeReportDecisionMap report={report} />
      </header>

      <section className="rounded-lg bg-white/95 px-3 py-3 ring-1 ring-stone-200/50 sm:px-3.5 sm:py-3.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-stone-400">Decision</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${decisionTone(decision.label)}`}
          >
            {decision.label}
          </span>
          <span className="text-[11px] text-stone-600">Confidence {decision.confidence}</span>
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-stone-950 sm:text-base">{q.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{q.explanation}</p>
      </section>

      <section className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <div className="rounded-lg bg-[#faf9f7] px-3 py-3 ring-1 ring-stone-200/40 sm:px-3.5 sm:py-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Intent fit</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-stone-950">{score.intentFitScore}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">{score.intentFitVerdict}</p>
        </div>
        <div className="rounded-lg bg-[#faf9f7] px-3 py-3 ring-1 ring-stone-200/40 sm:px-3.5 sm:py-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">{gapLabel}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-stone-950">{score.vibeGapScore}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">{score.verdict}</p>
          <p className="mt-1.5 text-[10px] leading-snug text-stone-500">{gapCaption}</p>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Top reasons</p>
        <ul className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-stone-700 sm:text-sm">
          {q.evidenceBullets.map((line, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-400" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <ReviewEvidencePanel place={report.place} showDataHonesty />

      <details className="group rounded-lg bg-white/95 ring-1 ring-stone-200/50">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-stone-900 outline-none marker:content-none sm:px-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Score detail</span>
            <span className="text-[10px] font-normal text-stone-400 group-open:hidden">Open</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-stone-100 px-3 pb-3 pt-2.5 sm:px-3.5 sm:pb-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <TagList title="Best for" items={report.bestFor} variant="best" />
            <TagList title="Avoid if" items={report.avoidIf} variant="avoid" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <ScoreCard label={gapLabel} value={score.vibeGapScore} hint={score.verdict} emphasis />
            <ScoreCard label="Intent fit" value={score.intentFitScore} hint={score.intentFitVerdict} emphasis />
            <ScoreCard
              label="Tourist density"
              value={score.touristDensityScore}
              hint="How discovered or tourist-heavy it feels in reviews."
            />
            <ScoreCard
              label="Wait risk"
              value={score.waitRiskScore}
              hint="Higher when lines, waits, or crowding show up in reviews."
            />
            <ScoreCard
              label="Laptop-friendly"
              value={score.laptopFriendlyScore}
              hint="Outlets, Wi‑Fi, or quiet seating vs. loud-room cues."
            />
            <ScoreCard
              label="Price mismatch risk"
              value={score.priceRealityScore}
              hint="When budget expectations may not match review themes."
            />
          </div>
          <div className="grid gap-2.5 lg:grid-cols-2">
            <div className="rounded-md bg-stone-50/80 px-2.5 py-2 ring-1 ring-stone-100/90">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">{gapRationaleTitle}</h3>
              <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-stone-600">
                {(isVenueCheck ? score.vibeGapExplanationBullets.slice(0, 1) : score.vibeGapExplanationBullets).map(
                  (b) => (
                    <li key={b} className="border-l border-stone-200 pl-2">
                      {b}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="rounded-md bg-stone-50/80 px-2.5 py-2 ring-1 ring-stone-100/90">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Intent fit rationale</h3>
              <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-stone-600">
                {score.intentFitExplanationBullets.map((b) => (
                  <li key={b} className="border-l border-stone-200 pl-2">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </details>

      <details className="group rounded-lg bg-white/95 ring-1 ring-stone-200/50">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-stone-900 outline-none marker:content-none sm:px-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Goal cues (scoring)</span>
            <span className="text-[10px] font-normal text-stone-400 group-open:hidden">Open</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-stone-100 px-3 pb-3 pt-3 sm:px-3.5 sm:pb-3.5">
          <p className="text-sm leading-relaxed text-stone-600">{report.socialSummary}</p>
          <VisualGrid posts={suppressOnCardCueList ? [] : report.socialHighlights} />
          <details className="rounded-md bg-stone-50/70 px-2.5 py-2 ring-1 ring-stone-100/90">
            <summary className="cursor-pointer text-[10px] font-medium text-stone-600">Full rationale</summary>
            <p className="mt-2 text-[12px] leading-relaxed text-stone-600">{decision.reason}</p>
          </details>
        </div>
      </details>

      <p className="text-[9px] leading-snug text-stone-400">{PRODUCT_HONESTY_FULL}</p>
    </article>
  );
}
