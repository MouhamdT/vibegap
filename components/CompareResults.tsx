"use client";

import { useMemo, useState } from "react";
import { PriorityTuningPanel } from "@/components/PriorityTuningPanel";
import {
  applyPriorityWeightsToCompare,
  getDefaultPriorityWeights,
  weightsEqual,
  type PriorityWeights,
} from "@/lib/ai/priorityTuning";
import { DecisionMapEntry } from "@/components/DecisionMapEntry";
import { ReviewEvidencePanel } from "@/components/ReviewEvidencePanel";
import { buildCompareReviewSummary } from "@/lib/ai/reviewReality";
import { compareMapPins } from "@/lib/maps/decisionMapModel";
import { placeHasCoordinates } from "@/lib/maps/placeCoordinates";
import type { CompareFactorRow, ComparePlaceSide, CompareResult } from "@/lib/types/vibecheck";

type CompareResultsProps = {
  compare: CompareResult;
};

function decisionPillClass(label: ComparePlaceSide["decision"]["label"]) {
  if (label === "GO") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-950";
  if (label === "SKIP") return "border-rose-200/70 bg-rose-50/55 text-rose-950";
  return "border-amber-200/70 bg-amber-50/55 text-amber-950";
}

function ComparePlaceCard({
  side,
  label,
  isWinner,
}: {
  side: ComparePlaceSide;
  label: "A" | "B";
  isWinner: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article
      className={`rounded-lg border bg-white p-3.5 sm:p-4 ${
        isWinner ? "border-stone-400/80 ring-1 ring-stone-200/50" : "border-stone-200/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Place {label}</p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-stone-950">{side.place.name}</h3>
        </div>
        {isWinner ? (
          <span className="shrink-0 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-700">
            Recommended
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-stone-600">{side.place.address}</p>
      <p className="mt-1 text-[11px] text-stone-500">
        <span className="font-medium text-stone-800">{side.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
        {side.place.reviewCount.toLocaleString()} reviews ·{" "}
        <span className="font-medium text-stone-800">{"$".repeat(side.place.priceLevel)}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${decisionPillClass(side.decision.label)}`}
        >
          {side.decision.label}
        </span>
        <span className="text-[11px] text-stone-600">Fit {side.fitScore}</span>
        <span className="text-[11px] text-stone-500">{side.reviewConfidence} confidence</span>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-stone-600">
        <span className="font-medium text-stone-700">Best for:</span> {side.bestFor}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-stone-500">
        <span className="font-medium text-stone-600">Risk:</span> {side.mainRisk}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-stone-500">
        <span className="font-medium text-stone-600">Avoid if:</span> {side.avoidIf}
      </p>

      <div className="mt-3 border-t border-stone-100 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Review evidence</p>
        <div className="mt-2">
          <ReviewEvidencePanel place={side.place} variant="compact" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-[11px] font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900"
      >
        {open ? "Hide details" : "View details"}
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">Top reasons</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-stone-600">
              {side.topReasons.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {side.scoreBreakdown.length > 0 ? (
            <details className="rounded-md border border-stone-100 bg-stone-50/50 px-2.5 py-2" open>
              <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500">
                Score breakdown
              </summary>
              <ul className="mt-2 space-y-1.5">
                {side.scoreBreakdown.map((row) => (
                  <li key={row.label} className="text-[10px] text-stone-600">
                    <span className="font-medium text-stone-800">{row.label}</span> · {row.score} — {row.explanation}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function CompareResults({ compare }: CompareResultsProps) {
  return <CompareResultsTunable key={compare.searchQueryDisplay} compare={compare} />;
}

function CompareResultsTunable({ compare }: CompareResultsProps) {
  const baselineWinnerId = compare.winnerPlaceId;
  const defaultWeights = useMemo(() => getDefaultPriorityWeights(compare.detectedIntent), [compare.detectedIntent]);
  const [weights, setWeights] = useState<PriorityWeights>(defaultWeights);
  const [userAdjusted, setUserAdjusted] = useState(false);

  const displayCompare = useMemo(() => {
    if (weightsEqual(weights, defaultWeights)) return compare;
    return applyPriorityWeightsToCompare(compare, weights);
  }, [compare, weights, defaultWeights]);

  const handleWeightsChange = (next: PriorityWeights) => {
    const merged = { ...next, atmosphere: defaultWeights.atmosphere };
    if (weightsEqual(merged, weights)) return;
    setUserAdjusted(true);
    setWeights(merged);
  };

  const handleReset = () => {
    setWeights(defaultWeights);
    setUserAdjusted(false);
  };

  const winnerUpdatedNote =
    userAdjusted && displayCompare.winnerPlaceId !== baselineWinnerId
      ? "Winner updated based on your priorities."
      : null;

  const winnerName =
    displayCompare.winnerPlaceId === displayCompare.sideA.place.id
      ? displayCompare.sideA.place.name
      : displayCompare.sideB.place.name;

  const compareMapCanRender =
    placeHasCoordinates(displayCompare.sideA.place) && placeHasCoordinates(displayCompare.sideB.place);

  const comparePins = useMemo(
    () => compareMapPins(displayCompare.sideA, displayCompare.sideB, displayCompare.winnerPlaceId),
    [displayCompare.sideA, displayCompare.sideB, displayCompare.winnerPlaceId],
  );

  const compareMapFooter =
    displayCompare.winnerPlaceId === displayCompare.sideA.place.id
      ? `Recommended: ${displayCompare.sideA.place.name}`
      : `Recommended: ${displayCompare.sideB.place.name}`;

  const factorRowsWithReality = useMemo(() => {
    const realityRow: CompareFactorRow = {
      factor: "Review reality",
      placeAValue: buildCompareReviewSummary(displayCompare.sideA.place, compare.detectedIntent),
      placeBValue: buildCompareReviewSummary(displayCompare.sideB.place, compare.detectedIntent),
      advantage: "—",
    };
    const rows = [...displayCompare.factorRows];
    const decisionIdx = rows.findIndex((r) => r.factor === "Overall decision");
    if (decisionIdx >= 0) {
      rows.splice(decisionIdx, 0, realityRow);
    } else {
      rows.push(realityRow);
    }
    return rows;
  }, [displayCompare, compare.detectedIntent]);

  const whereEachWins = useMemo(() => {
    const a: string[] = [];
    const b: string[] = [];
    for (const row of displayCompare.factorRows) {
      if (row.factor === "Overall decision") continue;
      if (row.advantage === "—" || row.advantage === "Tie") continue;
      if (row.advantage === displayCompare.sideA.place.name) a.push(row.factor);
      else if (row.advantage === displayCompare.sideB.place.name) b.push(row.factor);
    }
    return { a, b };
  }, [displayCompare.factorRows, displayCompare.sideA.place.name, displayCompare.sideB.place.name]);

  return (
    <section className="space-y-4" aria-label="Compare places">
      <header className="border-b border-stone-200/50 pb-3">
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-8 lg:gap-y-0">
          <div className="min-w-0 max-w-full space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">Compare mode</p>
            <h2 className="block w-full max-w-full text-lg font-semibold leading-snug tracking-tight text-stone-950 sm:text-xl">
              {compare.compareHeadlineTitle}
            </h2>
            <p className="block w-full max-w-full text-[12px] leading-relaxed text-stone-600 break-normal">
              {compare.compareHeadlineSubtitle}
            </p>
            {compare.partialResolveMessage ? (
              <p className="text-[11px] font-medium text-amber-900/90">{compare.partialResolveMessage}</p>
            ) : null}
            {compareMapCanRender ? (
              <div className="pt-1">
                <DecisionMapEntry
                  canRender={compareMapCanRender}
                  pins={comparePins}
                  title="Compare locations"
                  subtitle={compare.goalDisplay}
                  mapMode="compare"
                  footerPrimaryLine={compareMapFooter}
                />
              </div>
            ) : null}
          </div>
          <div className="w-full shrink-0 lg:w-auto lg:max-w-[min(380px,100%)] lg:justify-self-end">
            <PriorityTuningPanel
              weights={weights}
              defaultWeights={defaultWeights}
              onWeightsChange={handleWeightsChange}
              onReset={handleReset}
              rankingNote={userAdjusted ? "Ranking updated locally." : null}
              winnerUpdatedNote={winnerUpdatedNote}
              prioritiesSubLabel={userAdjusted ? "Custom priorities" : "Detected priorities"}
            />
          </div>
        </div>
      </header>

      <div className="rounded-lg border border-stone-200/70 bg-[#faf9f7] p-4 sm:p-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Recommended</p>
        <p className="mt-1 text-lg font-semibold text-stone-950">{winnerName}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-stone-700">
          <span className="font-medium text-stone-800">Why:</span> {displayCompare.whyWinner}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-stone-600">
          <span className="font-medium text-stone-700">Tradeoff:</span> {displayCompare.tradeoff}
        </p>
      </div>

      {(whereEachWins.a.length > 0 || whereEachWins.b.length > 0) && (
        <div className="grid gap-3 rounded-lg border border-stone-200/70 bg-white px-4 py-3.5 sm:grid-cols-2 sm:px-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">
              Where {displayCompare.sideA.place.name} leads
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-stone-600">
              {whereEachWins.a.length > 0 ? (
                whereEachWins.a.map((f) => <li key={f}>{f}</li>)
              ) : (
                <li className="text-stone-400">No clear factor wins in this table snapshot.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">
              Where {displayCompare.sideB.place.name} leads
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-stone-600">
              {whereEachWins.b.length > 0 ? (
                whereEachWins.b.map((f) => <li key={f}>{f}</li>)
              ) : (
                <li className="text-stone-400">No clear factor wins in this table snapshot.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ComparePlaceCard
          side={displayCompare.sideA}
          label="A"
          isWinner={displayCompare.winnerPlaceId === displayCompare.sideA.place.id}
        />
        <ComparePlaceCard
          side={displayCompare.sideB}
          label="B"
          isWinner={displayCompare.winnerPlaceId === displayCompare.sideB.place.id}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200/70">
        <table className="w-full min-w-[28rem] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-stone-200/80 bg-stone-50/80">
              <th className="px-3 py-2 font-medium text-stone-500">Factor</th>
              <th className="px-3 py-2 font-medium text-stone-800">{displayCompare.placeAName}</th>
              <th className="px-3 py-2 font-medium text-stone-800">{displayCompare.placeBName}</th>
              <th className="px-3 py-2 font-medium text-stone-500">Advantage</th>
            </tr>
          </thead>
          <tbody>
            {factorRowsWithReality.map((row) => (
              <tr key={row.factor} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 font-medium text-stone-700">{row.factor}</td>
                <td className="px-3 py-2 text-stone-600">{row.placeAValue}</td>
                <td className="px-3 py-2 text-stone-600">{row.placeBValue}</td>
                <td className="px-3 py-2 text-stone-600">{row.advantage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-stone-200/60 bg-white px-4 py-3.5 text-[12px] leading-relaxed text-stone-700">
        <p>{displayCompare.chooseWinnerIf}</p>
        <p className="mt-2">{displayCompare.chooseOtherIf}</p>
      </div>
    </section>
  );
}
