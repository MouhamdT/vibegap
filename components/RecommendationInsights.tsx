import type { RecommendationInsights as RecommendationInsightsModel } from "@/lib/types/vibecheck";

type RecommendationInsightsProps = {
  insights: RecommendationInsightsModel;
};

export function RecommendationInsights({ insights }: RecommendationInsightsProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Recommendation analytics</p>

      <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
        <p className="text-xs uppercase tracking-wider text-stone-500">Best overall</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">{insights.topPickName}</h3>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">{insights.topPickReason}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-3">
          <p className="text-[11px] uppercase tracking-wider text-stone-500">Main trade-off</p>
          <p className="mt-1 text-sm text-stone-700">{insights.mainTradeoff}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-3">
          <p className="text-[11px] uppercase tracking-wider text-stone-500">Strongest risk</p>
          <p className="mt-1 text-sm text-stone-700">{insights.strongestRisk}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-3">
          <p className="text-[11px] uppercase tracking-wider text-stone-500">Confidence note</p>
          <p className="mt-1 text-sm text-stone-700">{insights.confidenceNote}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-stone-500">Scoring weights</p>
        <div className="space-y-2">
          {insights.scoringWeights.map((w) => (
            <div key={w.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>{w.label}</span>
                <span className="font-medium text-stone-800">{w.weight}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-stone-500" style={{ width: `${w.weight}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs font-medium text-stone-600">{insights.decisionSummary}</p>
    </section>
  );
}
