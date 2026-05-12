import type { VibeReport as VibeReportModel } from "@/lib/types/vibecheck";
import { RealityPanel } from "@/components/RealityPanel";
import { ScoreCard } from "@/components/ScoreCard";
import { VisualGrid } from "@/components/VisualGrid";

export type VibeReportProps = {
  report: VibeReportModel | null;
};

export function VibeReport({ report }: VibeReportProps) {
  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-16 text-center">
        <p className="text-sm text-stone-500">
          Run a search to preview a mock VibeGap report — API wiring comes in the next version.
        </p>
      </div>
    );
  }

  return (
    <article className="space-y-8" aria-label="VibeGap report">
      <header className="flex flex-col gap-2 border-b border-stone-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Report</p>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{report.place.name}</h2>
          <p className="mt-1 text-sm text-stone-500">{report.place.address}</p>
        </div>
        <p className="text-xs text-stone-400 tabular-nums">
          Mock data · {new Date(report.generatedAt).toLocaleString()}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="social-heading">
            <h3 id="social-heading" className="mb-4 text-sm font-medium uppercase tracking-wider text-stone-500">
              Social snapshot
            </h3>
            <VisualGrid posts={report.socialHighlights} />
          </section>
          <RealityPanel place={report.place} summary={report.realitySummary} />
        </div>
        <div className="lg:col-span-1">
          <ScoreCard score={report.score} />
        </div>
      </div>
    </article>
  );
}
