"use client";

import { useMemo, useState } from "react";
import { DecisionMapModal } from "@/components/DecisionMapModal";
import { RecommendationDrillDownPanel } from "@/components/RecommendationDrillDownPanel";
import { VisitPlanMiniMap, type MiniMapStopPin } from "@/components/VisitPlanMiniMap";
import { proximityAdjustedFit, buildPlanVerdict, type PlanTravelMode } from "@/lib/ai/visitPlanScore";
import { formatFitScoreTen } from "@/lib/format/fitScoreTen";
import { formatDistance, getDistanceMeters } from "@/lib/geo/distance";
import { visitPlanMapPins } from "@/lib/maps/decisionMapModel";
import { getBrowserGoogleMapId, getBrowserGoogleMapsApiKey } from "@/lib/maps/googleMapsEnv";
import type { RankedCandidate, VisitPlanResult } from "@/lib/types/vibecheck";

export type VisitPlanResultsProps = {
  plan: VisitPlanResult;
  sourceLabel: string;
};

const ROWS_COLLAPSED = 5;

type PoolRow = {
  candidate: RankedCandidate;
  /** Fit after proximity adjustment (equals fitScore for stop 1). */
  displayFit: number;
  /** Distance from the previous locked stop (stop 2+ only). */
  distanceFromPrevMeters: number | null;
};

function decisionTone(label: RankedCandidate["decision"]["label"]) {
  if (label === "GO") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-950";
  if (label === "SKIP") return "border-rose-200/70 bg-rose-50/55 text-rose-950";
  return "border-amber-200/70 bg-amber-50/55 text-amber-950";
}

function candidateLatLng(c: RankedCandidate): { latitude: number; longitude: number } | null {
  const lat = c.place.latitude;
  const lng = c.place.longitude;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

function distanceBetween(a: RankedCandidate, b: RankedCandidate): number | null {
  const pa = candidateLatLng(a);
  const pb = candidateLatLng(b);
  if (!pa || !pb) return null;
  return getDistanceMeters(pa, pb);
}

function buildPoolRows(
  candidates: RankedCandidate[],
  prevPick: RankedCandidate | null,
  travelMode: PlanTravelMode,
): PoolRow[] {
  if (!prevPick) {
    return candidates.map((candidate) => ({
      candidate,
      displayFit: candidate.fitScore,
      distanceFromPrevMeters: null,
    }));
  }
  const rows = candidates.map((candidate) => {
    const d = distanceBetween(prevPick, candidate);
    return {
      candidate,
      displayFit: proximityAdjustedFit(candidate.fitScore, d, travelMode),
      distanceFromPrevMeters: d,
    };
  });
  return rows.sort((a, b) => b.displayFit - a.displayFit);
}

export function VisitPlanResults({ plan, sourceLabel }: VisitPlanResultsProps) {
  const [travelMode, setTravelMode] = useState<PlanTravelMode>("walking");
  const [picks, setPicks] = useState<(string | null)[]>(() => plan.stops.map(() => null));
  const [expanded, setExpanded] = useState<{ stopIdx: number; placeId: string } | null>(null);
  const [showAllStops, setShowAllStops] = useState<boolean[]>(() => plan.stops.map(() => false));
  const [mapOpen, setMapOpen] = useState(false);

  const mapsApiKey = useMemo(() => getBrowserGoogleMapsApiKey(), []);
  const mapId = useMemo(() => getBrowserGoogleMapId(), []);

  const pickedCandidates: (RankedCandidate | null)[] = plan.stops.map(
    (stop, idx) => stop.candidates.find((c) => c.place.id === picks[idx]) ?? null,
  );

  const stopPools: PoolRow[][] = plan.stops.map((stop, idx) =>
    buildPoolRows(stop.candidates, idx > 0 ? pickedCandidates[idx - 1] : null, travelMode),
  );

  const allPicked = pickedCandidates.every((c) => c !== null);
  const routeDistance =
    allPicked && pickedCandidates.length >= 2
      ? distanceBetween(pickedCandidates[0]!, pickedCandidates[1]!)
      : null;
  const verdict =
    allPicked && pickedCandidates.length >= 2
      ? buildPlanVerdict(pickedCandidates[0]!, pickedCandidates[1]!, routeDistance, travelMode)
      : null;

  const miniMapPins: MiniMapStopPin[] = [];
  pickedCandidates.forEach((c, idx) => {
    if (!c) return;
    const p = candidateLatLng(c);
    if (!p) return;
    miniMapPins.push({ stopNumber: idx + 1, name: c.place.name, lat: p.latitude, lng: p.longitude });
  });

  const planMapPins = visitPlanMapPins(
    plan.anchor,
    pickedCandidates.flatMap((c, idx) => (c ? [{ stopNumber: idx + 1, candidate: c }] : [])),
  );
  const canOpenRouteMap = Boolean(mapsApiKey) && planMapPins.some((p) => p.kind === "candidate");

  function handlePick(stopIdx: number, placeId: string) {
    setPicks((prev) => {
      const next = [...prev];
      if (next[stopIdx] === placeId) {
        next[stopIdx] = null;
      } else {
        next[stopIdx] = placeId;
      }
      // Later stops re-cascade off this pick, so their locks no longer apply.
      for (let i = stopIdx + 1; i < next.length; i += 1) next[i] = null;
      return next;
    });
    setExpanded(null);
  }

  const anchorConnector = plan.stops.length >= 2 ? " then " : "";
  const planTitle = `${plan.stops.map((s) => s.goalLabel).join(anchorConnector)} near ${plan.anchor.displayName}`;

  const verdictCard = verdict ? (
    <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Plan verdict</p>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${decisionTone(verdict.label)}`}
        >
          {verdict.label} · {formatFitScoreTen(verdict.score)}
        </span>
      </div>
      <ol className="mt-2 space-y-1">
        {pickedCandidates.map((c, idx) =>
          c ? (
            <li key={c.place.id} className="flex items-baseline gap-1.5 text-[12px] text-stone-800">
              <span className="font-semibold tabular-nums text-stone-500">{idx + 1}.</span>
              <span className="min-w-0 truncate font-medium">{c.place.name}</span>
              <span className="shrink-0 tabular-nums text-stone-500">{formatFitScoreTen(c.fitScore)}</span>
            </li>
          ) : null,
        )}
      </ol>
      {verdict.tradeoffLines.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-stone-200/70 pt-2">
          {verdict.tradeoffLines.map((line) => (
            <li key={line} className="text-[11px] leading-snug text-stone-600">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ) : (
    <div className="rounded-lg border border-dashed border-stone-200/80 bg-stone-50/40 p-3">
      <p className="text-[11px] leading-relaxed text-stone-500">
        Pick one place per stop to get a plan verdict.
      </p>
    </div>
  );

  return (
    <section aria-label="Visit plan results" className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Visit plan</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-stone-950 sm:text-lg">{planTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-stone-200/80 bg-white p-0.5"
            role="group"
            aria-label="Travel mode"
          >
            {(["walking", "car"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={travelMode === mode}
                onClick={() => setTravelMode(mode)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  travelMode === mode ? "bg-stone-950 text-white" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {mode === "walking" ? "Walking" : "Car"}
              </button>
            ))}
          </div>
          {canOpenRouteMap ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Route map
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-3 lg:order-none">
          {plan.stops.map((stop, stopIdx) => {
            const pool = stopPools[stopIdx]!;
            const pickedId = picks[stopIdx];
            const prevPicked = stopIdx === 0 || pickedCandidates[stopIdx - 1] !== null;
            const showAll = showAllStops[stopIdx]!;
            const rows = showAll ? pool : pool.slice(0, ROWS_COLLAPSED);
            const prevName = stopIdx > 0 ? pickedCandidates[stopIdx - 1]?.place.name ?? null : null;

            return (
              <div key={stop.goalQuery + stopIdx} className="rounded-lg border border-stone-200/60 bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-stone-100 px-3 py-2">
                  <p className="text-[12px] font-semibold text-stone-900">
                    <span className="mr-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-stone-950 px-1 text-[10px] font-bold tabular-nums text-white">
                      {stopIdx + 1}
                    </span>
                    {stop.goalLabel}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {stopIdx > 0 && prevName
                      ? `Re-ranked near ${prevName}`
                      : `Near ${plan.anchor.displayName}`}
                  </p>
                </div>

                {pool.length === 0 ? (
                  <p className="px-3 py-4 text-[12px] leading-relaxed text-stone-600">
                    No good {stop.goalLabel.toLowerCase()} matches near {plan.anchor.displayName} — try widening
                    the area or rephrasing this stop.
                  </p>
                ) : (
                  <div role="list" aria-label={`Stop ${stopIdx + 1} options`} className="divide-y divide-stone-100">
                    {rows.map((row) => {
                      const c = row.candidate;
                      const isPicked = pickedId === c.place.id;
                      const dimmed = pickedId !== null && !isPicked;
                      const isExpanded = expanded?.stopIdx === stopIdx && expanded.placeId === c.place.id;
                      const distanceLine =
                        stopIdx > 0 && row.distanceFromPrevMeters != null
                          ? `~${formatDistance(row.distanceFromPrevMeters)} from stop ${stopIdx}`
                          : typeof c.distanceFromAnchorMeters === "number"
                            ? `~${formatDistance(c.distanceFromAnchorMeters)} from anchor`
                            : null;

                      return (
                        <div key={c.place.id} role="listitem" className={dimmed ? "opacity-55" : undefined}>
                          <div
                            className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                              isPicked ? "bg-stone-50/90" : "hover:bg-stone-50/50"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handlePick(stopIdx, c.place.id)}
                              disabled={!prevPicked}
                              aria-pressed={isPicked}
                              className={`min-w-0 flex-1 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed ${
                                !prevPicked ? "opacity-70" : ""
                              }`}
                            >
                              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span
                                  className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${decisionTone(c.decision.label)}`}
                                >
                                  {c.decision.label}
                                </span>
                                <span className="min-w-0 text-sm font-semibold tracking-tight text-stone-950">
                                  {c.place.name}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-[11px] text-stone-500">
                                <span className="font-medium tabular-nums text-stone-800">
                                  {formatFitScoreTen(row.displayFit)}
                                </span>
                                {distanceLine ? (
                                  <>
                                    <span className="text-stone-300"> · </span>
                                    <span>{distanceLine}</span>
                                  </>
                                ) : null}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded(isExpanded ? null : { stopIdx, placeId: c.place.id })
                              }
                              className="shrink-0 text-[11px] font-medium text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
                            >
                              {isExpanded ? "Hide" : "Details"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePick(stopIdx, c.place.id)}
                              disabled={!prevPicked}
                              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                isPicked
                                  ? "border-stone-900 bg-stone-950 text-white"
                                  : "border-stone-200/90 bg-white text-stone-700 hover:bg-stone-50"
                              }`}
                            >
                              {isPicked ? "Picked" : "Pick"}
                            </button>
                          </div>
                          {isExpanded ? (
                            <RecommendationDrillDownPanel
                              candidate={c}
                              rank={pool.indexOf(row) + 1}
                              variant="inline"
                              onClose={() => setExpanded(null)}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {pool.length > ROWS_COLLAPSED ? (
                  <div className="border-t border-stone-100 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllStops((prev) => prev.map((v, i) => (i === stopIdx ? !v : v)))
                      }
                      className="text-[11px] font-medium text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
                    >
                      {showAll ? "Show fewer" : `Show all ${pool.length}`}
                    </button>
                  </div>
                ) : null}

                {stopIdx > 0 && !prevPicked ? (
                  <p className="border-t border-stone-100 px-3 py-1.5 text-[10px] text-stone-400">
                    Pick stop {stopIdx} first — this list re-ranks around it.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <aside className="order-first min-w-0 space-y-3 lg:order-none lg:sticky lg:top-4 lg:self-start">
          <VisitPlanMiniMap
            anchorName={plan.anchor.displayName}
            anchorLat={plan.anchor.latitude}
            anchorLng={plan.anchor.longitude}
            stopPins={miniMapPins}
            routeDistanceMeters={routeDistance}
          />
          {verdictCard}
        </aside>
      </div>

      {/* Mobile sticky verdict bar once the plan is complete. */}
      {verdict ? (
        <div className="sticky bottom-2 z-10 lg:hidden">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <p className="min-w-0 truncate text-[12px] font-medium text-stone-800">
              {pickedCandidates.map((c) => c?.place.name).filter(Boolean).join(" → ")}
            </p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${decisionTone(verdict.label)}`}
            >
              {verdict.label} · {formatFitScoreTen(verdict.score)}
            </span>
          </div>
        </div>
      ) : null}

      <p className="text-[10px] leading-snug text-stone-400">{sourceLabel} Distances are approximate.</p>

      {mapsApiKey ? (
        <DecisionMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          apiKey={mapsApiKey}
          mapId={mapId}
          pins={planMapPins}
          title="Route map"
          subtitle={planTitle}
          mapMode="plan"
          footerPrimaryLine={
            routeDistance != null
              ? `~${formatDistance(routeDistance)} between stops (straight line).`
              : null
          }
        />
      ) : null}
    </section>
  );
}
