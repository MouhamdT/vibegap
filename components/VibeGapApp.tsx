"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalysisStatusLine } from "@/components/AnalysisStatusLine";
import { ExampleSearchChips } from "@/components/ExampleSearchChips";
import { SearchBar } from "@/components/SearchBar";
import { CandidateResults } from "@/components/CandidateResults";
import { VibeReport } from "@/components/VibeReport";
import type { RankedCandidate, VibeReport as VibeReportModel, VibecheckResponse } from "@/lib/types/vibecheck";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecommendationsPayload(value: unknown): value is Extract<VibecheckResponse, { mode: "recommendations" }> {
  if (!isRecord(value)) return false;
  if (value.mode !== "recommendations") return false;
  if (!isRecord(value.detectedIntent)) return false;
  if (typeof value.detectedIntent.label !== "string") return false;
  if (typeof value.detectedIntent.kind !== "string") return false;
  if (typeof value.locationCandidate !== "string") return false;
  if (!Array.isArray(value.candidates)) return false;
  if (typeof value.sourceLabel !== "string") return false;
  return true;
}

function isNeedsLocationPayload(value: unknown): value is Extract<VibecheckResponse, { mode: "needs_location" }> {
  if (!isRecord(value)) return false;
  if (value.mode !== "needs_location") return false;
  if (typeof value.detectedIntentLabel !== "string") return false;
  if (value.locationCandidate !== null) return false;
  if (!Array.isArray(value.candidates)) return false;
  if (typeof value.recoveryMessage !== "string") return false;
  return true;
}

function isSingleReportPayload(value: unknown): value is Extract<VibecheckResponse, { mode: "single_report" }> {
  if (!isRecord(value) || !("report" in value)) return false;
  if (value.mode !== "single_report") return false;
  const reportUnknown = value.report;
  if (!isRecord(reportUnknown)) return false;

  if (typeof reportUnknown.searchQueryDisplay !== "string") return false;

  const pnc = reportUnknown.placeNameCandidate;
  if (!(pnc === null || typeof pnc === "string")) return false;
  if (typeof reportUnknown.queryExplanation !== "string") return false;
  if (typeof reportUnknown.queryContextBanner !== "string") return false;

  const pigd = reportUnknown.placeIntentGoalDisplay;
  if (!(pigd === null || typeof pigd === "string")) return false;

  const gpf = reportUnknown.googlePlacesFallback;
  if (gpf !== "none" && gpf !== "no_confident_match" && gpf !== "lookup_unavailable") return false;
  if (typeof reportUnknown.suggestPlaceDisambiguation !== "boolean") return false;

  if (
    reportUnknown.narrativeSource !== "rules" &&
    reportUnknown.narrativeSource !== "openai" &&
    reportUnknown.narrativeSource !== "gemini"
  ) {
    return false;
  }
  if (typeof reportUnknown.aiNarrativeUsed !== "boolean") return false;

  if (typeof reportUnknown.generatedAt !== "string") return false;
  if (typeof reportUnknown.socialSummary !== "string") return false;
  if (typeof reportUnknown.realitySummary !== "string") return false;

  if (!isRecord(reportUnknown.place) || typeof reportUnknown.place.name !== "string") return false;

  if (!isRecord(reportUnknown.score) || typeof reportUnknown.score.vibeGapScore !== "number") return false;
  if (typeof reportUnknown.score.intentFitScore !== "number") return false;
  if (typeof reportUnknown.score.intentFitVerdict !== "string") return false;
  if (!Array.isArray(reportUnknown.score.vibeGapExplanationBullets)) return false;
  if (!Array.isArray(reportUnknown.score.intentFitExplanationBullets)) return false;

  if (!isRecord(reportUnknown.detectedIntent)) return false;
  if (typeof reportUnknown.detectedIntent.kind !== "string") return false;
  if (typeof reportUnknown.detectedIntent.label !== "string") return false;
  if (reportUnknown.detectedIntent.confidence !== "high" && reportUnknown.detectedIntent.confidence !== "medium" && reportUnknown.detectedIntent.confidence !== "low") {
    return false;
  }
  if (!Array.isArray(reportUnknown.detectedIntent.matchedSignals)) return false;

  if (!Array.isArray(reportUnknown.socialHighlights)) return false;

  if (!isRecord(reportUnknown.decision)) return false;
  if (reportUnknown.decision.label !== "GO" && reportUnknown.decision.label !== "MAYBE" && reportUnknown.decision.label !== "SKIP") {
    return false;
  }
  if (
    reportUnknown.decision.confidence !== "High" &&
    reportUnknown.decision.confidence !== "Medium" &&
    reportUnknown.decision.confidence !== "Low"
  ) {
    return false;
  }
  if (typeof reportUnknown.decision.reason !== "string") return false;

  if (!isRecord(reportUnknown.quickVerdict)) return false;
  if (typeof reportUnknown.quickVerdict.title !== "string") return false;
  if (typeof reportUnknown.quickVerdict.explanation !== "string") return false;
  if (!Array.isArray(reportUnknown.quickVerdict.evidenceBullets)) return false;
  if (reportUnknown.quickVerdict.evidenceBullets.length !== 3) return false;
  for (const b of reportUnknown.quickVerdict.evidenceBullets) {
    if (typeof b !== "string") return false;
  }

  if (!Array.isArray(reportUnknown.bestFor) || !Array.isArray(reportUnknown.avoidIf)) return false;

  if (!isRecord(reportUnknown.recommendation)) return false;
  if (typeof reportUnknown.recommendation.headline !== "string") return false;
  if (typeof reportUnknown.recommendation.body !== "string") return false;

  return true;
}

export function VibeGapApp() {
  const [searchInput, setSearchInput] = useState("");
  const [report, setReport] = useState<VibeReportModel | null>(null);
  const [recommendations, setRecommendations] = useState<{
    detectedIntent: Extract<VibecheckResponse, { mode: "recommendations" }>["detectedIntent"];
    locationCandidate: string;
    candidates: RankedCandidate[];
    sourceLabel: string;
    nearAnchorName?: string | null;
    anchorNote?: string | null;
  } | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadPhase, setLoadPhase] = useState(0);

  useEffect(() => {
    if (!loading) return;
    let phase = 0;
    const id = window.setInterval(() => {
      phase = (phase + 1) % 3;
      setLoadPhase(phase);
    }, 650);
    return () => window.clearInterval(id);
  }, [loading]);

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setLoadPhase(0);
    setError(null);
    try {
      const res = await fetch("/api/vibecheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const raw: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          isRecord(raw) && typeof raw.error === "string" ? raw.error : `Request failed (${res.status})`;
        setError(msg);
        return;
      }

      if (isRecommendationsPayload(raw)) {
        setRecommendations({
          detectedIntent: raw.detectedIntent,
          locationCandidate: raw.locationCandidate,
          candidates: raw.candidates as RankedCandidate[],
          sourceLabel: raw.sourceLabel,
          nearAnchorName: typeof raw.nearAnchorName === "string" ? raw.nearAnchorName : null,
          anchorNote: typeof raw.anchorNote === "string" ? raw.anchorNote : null,
        });
        setReport(null);
        setRecoveryMessage(null);
        return;
      }

      if (isNeedsLocationPayload(raw)) {
        setReport(null);
        setRecommendations(null);
        setRecoveryMessage(raw.recoveryMessage);
        return;
      }

      if (!isSingleReportPayload(raw)) {
        setError("Unable to parse the server response.");
        return;
      }

      setReport(raw.report);
      setRecommendations(null);
      setRecoveryMessage(null);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const useCompactChrome = Boolean(report || recommendations || recoveryMessage);
  const isRecommendationLayout = Boolean(recommendations);
  const hasResultsBody = Boolean(recommendations || recoveryMessage || report);
  const busyLabel = useCompactChrome ? "Updating results…" : "Finding matches…";

  return (
    <div
      className={`mx-auto w-full ${isRecommendationLayout ? "max-w-6xl" : "max-w-5xl"} ${useCompactChrome ? "space-y-4 sm:space-y-4" : "space-y-8 sm:space-y-10"}`}
    >
      {!useCompactChrome ? (
        <div className="flex flex-col items-center space-y-8 text-center sm:space-y-9">
          <header className="max-w-xl space-y-3 px-1 sm:max-w-2xl">
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              Find the right place for the plan.
            </h1>
            <p className="text-pretty text-sm leading-relaxed text-stone-600 sm:text-base">
              Rank places by fit, risk, and review reality — not just hype.
            </p>
          </header>

          <div className="flex w-full flex-col items-center gap-3">
            <SearchBar
              value={searchInput}
              onValueChange={setSearchInput}
              onSearch={runSearch}
              disabled={loading}
              busy={loading}
              busyLabel={busyLabel}
              placeholder="Try: quiet place to study in Tel Aviv"
              submitLabel="Find matches"
              layout="hero"
            />
            <ExampleSearchChips
              disabled={loading}
              onSelect={async (q) => {
                setSearchInput(q);
                await runSearch(q);
              }}
            />
            {loading ? (
              <div className="flex w-full max-w-xl flex-col items-center gap-1.5 sm:max-w-2xl">
                <p className="text-[12px] font-medium text-stone-500">{busyLabel}</p>
                <AnalysisStatusLine activePhase={loadPhase} />
              </div>
            ) : null}
            <p className="max-w-md px-2 text-[11px] leading-relaxed text-stone-400">
              Goal-first recommendations · Review-signal scoring · Transparent tradeoffs
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 border-b border-stone-200/40 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="min-w-0 max-w-md shrink-0 space-y-1 lg:pt-0.5">
              <h1 className="text-lg font-semibold tracking-tight text-stone-950 sm:text-xl">Find the right place for the plan.</h1>
              <p className="text-xs leading-relaxed text-stone-500 sm:text-sm">
                Rank places by fit, risk, and review reality — not just hype.
              </p>
            </div>
            <div className="min-w-0 w-full flex-1 lg:flex lg:justify-end">
              <div className="w-full lg:max-w-[680px]">
                <SearchBar
                  value={searchInput}
                  onValueChange={setSearchInput}
                  onSearch={runSearch}
                  disabled={loading}
                  busy={loading}
                  busyLabel={busyLabel}
                  placeholder="Try: quiet place to study in Tel Aviv"
                  submitLabel="Find matches"
                  layout="compact"
                />
              </div>
            </div>
          </div>
          {loading ? (
            <div className="flex flex-col gap-1.5 lg:ml-auto lg:max-w-[680px]">
              <p className="text-[12px] font-medium text-stone-500">{busyLabel}</p>
              <AnalysisStatusLine activePhase={loadPhase} />
            </div>
          ) : null}
          {error ? (
            <div
              className="rounded-lg border border-red-200/70 bg-red-50/40 px-3 py-2 text-sm text-red-800 lg:ml-auto lg:max-w-[680px]"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>
      )}

      {!useCompactChrome && error ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {hasResultsBody ? (
        <div className="rounded-xl border border-stone-200/50 bg-white/90 p-4 sm:p-5">
          {recoveryMessage ? (
            <div className="rounded-xl border border-dashed border-stone-100 bg-stone-50/30 px-5 py-10 text-center sm:px-8 sm:py-12">
              <p className="text-sm leading-relaxed text-stone-600">{recoveryMessage}</p>
            </div>
          ) : recommendations ? (
            <CandidateResults
              key={recommendations.candidates.map((c) => c.place.id).join("\u001f")}
              detectedIntent={recommendations.detectedIntent}
              locationCandidate={recommendations.locationCandidate}
              candidates={recommendations.candidates}
              nearAnchorName={recommendations.nearAnchorName ?? undefined}
              anchorNote={recommendations.anchorNote ?? undefined}
            />
          ) : report ? (
            <VibeReport report={report} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
