import type { QueryMode, VibeReport as VibeReportModel } from "@/lib/types/vibecheck";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { RealityPanel } from "@/components/RealityPanel";
import { ScoreCard } from "@/components/ScoreCard";
import { VisualGrid } from "@/components/VisualGrid";

export type VibeReportProps = {
  report: VibeReportModel | null;
};

function TagList({ title, items, variant }: { title: string; items: string[]; variant: "best" | "avoid" }) {
  const chip =
    variant === "best"
      ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-950"
      : "border-rose-200/80 bg-rose-50/90 text-rose-950";
  return (
    <div>
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-stone-500">{title}</h3>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {items.map((t) => (
          <li key={t} className={`rounded-full border px-2.5 py-1 text-xs font-medium leading-snug ${chip}`}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function scoreHintLabels(mode: QueryMode): { intent: string; vibe: string } {
  if (mode === "goal_search") {
    return { intent: "Primary for this search", vibe: "Mock social comparison" };
  }
  if (mode === "specific_place") {
    return { intent: "Neutral add-on", vibe: "Mock social comparison" };
  }
  return { intent: "Your goal", vibe: "Mock social comparison" };
}

function QuickVerdictCard({ report }: { report: VibeReportModel }) {
  const q = report.quickVerdict;
  const { score } = report;
  const hints = scoreHintLabels(report.queryMode);

  return (
    <section
      className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-sm sm:p-8"
      aria-labelledby="quick-verdict-heading"
    >
      <p id="quick-verdict-heading" className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
        Quick verdict
      </p>
      <p className="mt-1 text-[10px] font-normal tracking-wide text-stone-400">
        {report.narrativeSource === "gemini"
          ? "Gemini-polished summary"
          : report.narrativeSource === "openai"
            ? "AI-polished summary"
            : "Rule-based summary"}
      </p>
      <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        {q.title}
      </h2>
      <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-stone-600 sm:text-[1.05rem]">
        {q.explanation}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-100 bg-stone-50/90 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Intent fit</p>
          <p className="mt-0.5 text-[10px] text-stone-400">{hints.intent}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-stone-900">{score.intentFitScore}</p>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">{score.intentFitVerdict}</p>
        </div>
        <div className="rounded-2xl border border-stone-100 bg-stone-50/90 px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">VibeGap</p>
          <p className="mt-0.5 text-[10px] text-stone-400">{hints.vibe}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-stone-900">{score.vibeGapScore}</p>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">{score.verdict}</p>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Top reasons</p>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-stone-800">
          {q.evidenceBullets.map((line, index) => (
            <li key={index} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 grid gap-8 border-t border-stone-100 pt-8 sm:grid-cols-2">
        <TagList title="Best for" items={report.bestFor} variant="best" />
        <TagList title="Avoid if" items={report.avoidIf} variant="avoid" />
      </div>
    </section>
  );
}

export function VibeReport({ report }: VibeReportProps) {
  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-16 text-center">
        <p className="text-sm text-stone-500">
          Try a place name or a goal (for example, “quiet place to study”), then tap{" "}
          <span className="font-medium text-stone-800">Check vibe</span>.
        </p>
      </div>
    );
  }

  const { score, detectedIntent } = report;
  const sourceLabel =
    report.place.dataSource === "google"
      ? report.place.hasRealGoogleReviews
        ? "Google Places data · Google review signals · Mock social signals"
        : "Google Places data · Mock review signals · Mock social signals"
      : "Illustrative mock place data · Mock social signals";
  const placeNameForRow =
    report.placeNameCandidate !== null && report.placeNameCandidate !== ""
      ? formatSearchQueryForDisplay(report.placeNameCandidate)
      : null;
  const showPlaceGoalRow =
    report.queryMode === "place_with_intent" &&
    placeNameForRow !== null &&
    report.placeIntentGoalDisplay;

  return (
    <article className="space-y-12 sm:space-y-14" aria-label="VibeGap report">
      <header className="space-y-2 border-b border-stone-100 pb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Your search</p>
        <p className="text-lg font-medium tracking-tight text-stone-900 sm:text-xl">{report.searchQueryDisplay}</p>
        <p className="text-sm font-medium text-stone-800">{report.queryContextBanner}</p>
        <p className="max-w-2xl text-xs leading-relaxed text-stone-500">{report.queryExplanation}</p>
        {report.googlePlacesFallback === "no_confident_match" ? (
          <p className="max-w-2xl text-xs leading-relaxed text-stone-500">
            No confident Google Places match found — using illustrative mock data.
          </p>
        ) : null}
        {report.googlePlacesFallback === "lookup_unavailable" ? (
          <p className="max-w-2xl text-xs leading-relaxed text-stone-500">
            Google Places lookup unavailable — using illustrative mock data.
          </p>
        ) : null}
        {report.suggestPlaceDisambiguation ? (
          <p className="max-w-2xl text-xs leading-relaxed text-stone-500">
            Tip: add a city or neighborhood for a more precise match.
          </p>
        ) : null}
        {showPlaceGoalRow ? (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-stone-600">
            <span>
              <span className="text-stone-500">Place</span>{" "}
              <span className="font-medium text-stone-800">
                {placeNameForRow}
              </span>
            </span>
            <span>
              <span className="text-stone-500">Goal</span>{" "}
              <span className="font-medium text-stone-800">{report.placeIntentGoalDisplay}</span>
            </span>
          </div>
        ) : null}
        <h1 className="pt-4 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{report.place.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600">{report.place.address}</p>
        <p className="text-xs text-stone-500">
          <span className="font-medium text-stone-700">{report.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
          {report.place.reviewCount.toLocaleString()} reviews ·{" "}
          <span className="font-medium text-stone-700">{"$".repeat(report.place.priceLevel)}</span>
          {showPlaceGoalRow ? null : (
            <span className="text-stone-400"> · {detectedIntent.label}</span>
          )}
        </p>
        <p className="text-xs text-stone-400 tabular-nums">
          <span className="text-stone-500">{sourceLabel}</span>
          {" · "}
          {new Date(report.generatedAt).toLocaleString()}
        </p>
      </header>

      <QuickVerdictCard report={report} />

      <details className="group rounded-2xl border border-stone-200/80 bg-stone-50/40 open:bg-white open:shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-stone-800 outline-none marker:content-none sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-3">
            <span>Full analysis</span>
            <span className="text-xs font-normal text-stone-500 group-open:hidden">Tap to expand</span>
            <span className="hidden text-xs font-normal text-stone-500 group-open:inline">Tap to collapse</span>
          </span>
        </summary>
        <div className="space-y-12 border-t border-stone-100 px-5 pb-8 pt-6 sm:px-6 sm:pb-10">
          <section aria-labelledby="social-heading" className="space-y-3">
            <h2 id="social-heading" className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Social snapshot
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600">{report.socialSummary}</p>
            <VisualGrid posts={report.socialHighlights} />
          </section>

          <section aria-labelledby="review-heading" className="space-y-3">
            <h2 id="review-heading" className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Review detail
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600">{report.realitySummary}</p>
            <RealityPanel place={report.place} />
          </section>

          <section aria-labelledby="scores-heading" className="space-y-4">
            <h2 id="scores-heading" className="text-xs font-medium uppercase tracking-wider text-stone-500">
              All scores
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-stone-500">
              VibeGap = mock social comparison vs. available place signals. Intent Fit = your goal vs. likely
              experience. Other rows add context (waits, laptops, price mismatch risk).
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ScoreCard label="VibeGap" value={score.vibeGapScore} hint={score.verdict} emphasis />
              <ScoreCard label="Intent fit" value={score.intentFitScore} hint={score.intentFitVerdict} emphasis />
              <ScoreCard
                label="Tourist density"
                value={score.touristDensityScore}
                hint="How discovered or tourist-heavy it feels in reviews."
              />
              <ScoreCard
                label="Wait risk"
                value={score.waitRiskScore}
                hint="Higher when lines, waits, or crowding show up in clips or reviews."
              />
              <ScoreCard
                label="Laptop-friendly"
                value={score.laptopFriendlyScore}
                hint="Higher when outlets, Wi‑Fi, or quiet seating show up — lower for party or loud-room cues."
              />
              <ScoreCard
                label="Price mismatch risk"
                value={score.priceRealityScore}
                hint="Higher when budget clip talk clashes with price or portion complaints in reviews."
              />
              <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Hype vs. reality</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-stone-500">Hype index</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">{score.hypeIndex}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">Reality index</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900">{score.realityIndex}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-stone-500">VibeGap rationale</h3>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">
                  {score.vibeGapExplanationBullets.map((b) => (
                    <li key={b} className="border-l-2 border-stone-200 pl-3">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Intent fit rationale</h3>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">
                  {score.intentFitExplanationBullets.map((b) => (
                    <li key={b} className="border-l-2 border-stone-200 pl-3">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </details>
    </article>
  );
}
