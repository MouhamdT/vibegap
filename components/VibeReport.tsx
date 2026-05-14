import type { QueryMode, VibeReport as VibeReportModel } from "@/lib/types/vibecheck";
import { formatSearchQueryForDisplay } from "@/lib/formatSearchQueryDisplay";
import { RealityPanel } from "@/components/RealityPanel";
import { ScoreCard } from "@/components/ScoreCard";
import { VisualGrid } from "@/components/VisualGrid";

export type VibeReportProps = {
  report: VibeReportModel | null;
};

const PLACE_HONESTY = "Uses Google Places and available review signals. Social comparison is illustrative.";

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

function scoreHintLabels(mode: QueryMode): { intent: string; vibe: string } {
  if (mode === "goal_search") {
    return { intent: "Primary for this search", vibe: "Illustrative comparison" };
  }
  if (mode === "specific_place") {
    return { intent: "Neutral add-on", vibe: "Illustrative comparison" };
  }
  return { intent: "Your goal", vibe: "Illustrative comparison" };
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
  const hints = scoreHintLabels(report.queryMode);
  const placeNameForRow =
    report.placeNameCandidate !== null && report.placeNameCandidate !== ""
      ? formatSearchQueryForDisplay(report.placeNameCandidate)
      : null;
  const showPlaceGoalRow =
    report.queryMode === "place_with_intent" && placeNameForRow !== null && report.placeIntentGoalDisplay;

  return (
    <article className="space-y-5 sm:space-y-6" aria-label="VibeGap report">
      <header className="space-y-2 border-b border-stone-200/50 pb-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Your search</p>
        <p className="text-sm font-medium tracking-tight text-stone-900">{report.searchQueryDisplay}</p>
        <p className="text-xs font-medium text-stone-800">{report.queryContextBanner}</p>
        <p className="max-w-2xl text-[11px] leading-relaxed text-stone-500">{report.queryExplanation}</p>
        {report.googlePlacesFallback === "no_confident_match" ? (
          <p className="max-w-2xl text-[11px] leading-relaxed text-stone-600">
            I couldn&apos;t find a confident match for that search. Try adding a city, neighborhood, or landmark.
          </p>
        ) : null}
        {report.googlePlacesFallback === "lookup_unavailable" ? (
          <p className="max-w-2xl text-[11px] text-stone-500">Venue lookup unavailable — illustrative data in use.</p>
        ) : null}
        {report.suggestPlaceDisambiguation ? (
          <p className="max-w-2xl text-[11px] text-stone-500">Tip: add a city or neighborhood for a tighter match.</p>
        ) : null}
        {showPlaceGoalRow ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-600">
            <span>
              <span className="text-stone-500">Place</span>{" "}
              <span className="font-medium text-stone-900">{placeNameForRow}</span>
            </span>
            <span>
              <span className="text-stone-500">Goal</span>{" "}
              <span className="font-medium text-stone-900">{report.placeIntentGoalDisplay}</span>
            </span>
          </div>
        ) : null}
        <h1 className="pt-2 text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">{report.place.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600">{report.place.address}</p>
        <p className="text-[11px] text-stone-500">
          <span className="font-medium text-stone-800">{report.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
          {report.place.reviewCount.toLocaleString()} reviews ·{" "}
          <span className="font-medium text-stone-800">{"$".repeat(report.place.priceLevel)}</span>
          {showPlaceGoalRow ? null : <span className="text-stone-400"> · {detectedIntent.label}</span>}
        </p>
        <p className="text-[11px] leading-relaxed text-stone-500">{PLACE_HONESTY}</p>
        <p className="text-[10px] text-stone-400 tabular-nums">{new Date(report.generatedAt).toLocaleString()}</p>
      </header>

      <section className="rounded-lg border border-stone-200/60 bg-white p-3.5 sm:p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Decision</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${decisionTone(decision.label)}`}>
            {decision.label}
          </span>
          <span className="text-[11px] text-stone-600">Confidence {decision.confidence}</span>
        </div>
        <p className="mt-3 text-base font-semibold leading-snug text-stone-950">{q.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{q.explanation}</p>
        <p className="mt-3 text-[10px] text-stone-400">
          {report.narrativeSource === "gemini"
            ? "Gemini-polished copy"
            : report.narrativeSource === "openai"
              ? "AI-polished copy"
              : "Rule-based copy"}
        </p>
        <details className="mt-3 rounded-md border border-stone-100 bg-stone-50/40 px-3 py-2">
          <summary className="cursor-pointer text-[10px] font-medium text-stone-600">Full rationale</summary>
          <p className="mt-2 text-[12px] leading-relaxed text-stone-600">{decision.reason}</p>
        </details>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200/60 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Intent fit</p>
          <p className="mt-0.5 text-[10px] text-stone-400">{hints.intent}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">{score.intentFitScore}</p>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">{score.intentFitVerdict}</p>
        </div>
        <div className="rounded-lg border border-stone-200/60 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">VibeGap</p>
          <p className="mt-0.5 text-[10px] text-stone-400">{hints.vibe}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">{score.vibeGapScore}</p>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">{score.verdict}</p>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Top reasons</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-700">
          {q.evidenceBullets.map((line, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-400" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 border-t border-stone-200/50 pt-5 sm:grid-cols-2">
        <TagList title="Best for" items={report.bestFor} variant="best" />
        <TagList title="Avoid if" items={report.avoidIf} variant="avoid" />
      </div>

      <details className="group rounded-lg border border-stone-200/60 bg-white open:bg-[#faf9f7]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-900 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Review detail</span>
            <span className="text-[10px] font-normal text-stone-400 group-open:hidden">Open</span>
            <span className="hidden text-[10px] font-normal text-stone-400 group-open:inline">Close</span>
          </span>
        </summary>
        <div className="border-t border-stone-200/50 px-4 pb-4 pt-3">
          <p className="text-sm leading-relaxed text-stone-600">{report.realitySummary}</p>
          <div className="mt-4">
            <RealityPanel place={report.place} />
          </div>
        </div>
      </details>

      <details className="group rounded-lg border border-stone-200/60 bg-white open:bg-[#faf9f7]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-900 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Score detail</span>
            <span className="text-[10px] font-normal text-stone-400 group-open:hidden">Open</span>
            <span className="hidden text-[10px] font-normal text-stone-400 group-open:inline">Close</span>
          </span>
        </summary>
        <div className="border-t border-stone-200/50 px-4 pb-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
            <div className="rounded-lg border border-stone-200/60 bg-white p-3 sm:col-span-2 xl:col-span-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Hype vs. reality</p>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-stone-500">Hype index</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-stone-950">{score.hypeIndex}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Reality index</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-stone-950">{score.realityIndex}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-stone-200/60 bg-white p-3">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">VibeGap rationale</h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-600">
                {score.vibeGapExplanationBullets.map((b) => (
                  <li key={b} className="border-l border-stone-200 pl-2">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-stone-200/60 bg-white p-3">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Intent fit rationale</h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-600">
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

      <details className="group rounded-lg border border-stone-200/60 bg-white open:bg-[#faf9f7]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-900 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>Full analysis</span>
            <span className="text-[10px] font-normal text-stone-400 group-open:hidden">Open</span>
            <span className="hidden text-[10px] font-normal text-stone-400 group-open:inline">Close</span>
          </span>
        </summary>
        <div className="space-y-6 border-t border-stone-200/50 px-4 pb-4 pt-4">
          <section>
            <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Social snapshot</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">{report.socialSummary}</p>
            <VisualGrid posts={report.socialHighlights} />
          </section>
        </div>
      </details>
    </article>
  );
}
