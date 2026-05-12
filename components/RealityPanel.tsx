import type { PlaceData } from "@/lib/types/vibecheck";

export type RealityPanelProps = {
  place: PlaceData;
};

function sentimentStyles(sentiment: PlaceData["reviewThemes"][number]["sentiment"]): string {
  switch (sentiment) {
    case "positive":
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    case "negative":
      return "bg-rose-50 text-rose-900 ring-rose-100";
    default:
      return "bg-amber-50 text-amber-900 ring-amber-100";
  }
}

export function RealityPanel({ place }: RealityPanelProps) {
  const priceLabel = "$".repeat(place.priceLevel);

  return (
    <section
      className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm"
      aria-labelledby="reality-heading"
    >
      <h3 id="reality-heading" className="text-sm font-medium uppercase tracking-wider text-stone-500">
        Review detail
      </h3>
      <p className="mt-2 text-lg font-semibold tracking-tight text-stone-900">{place.name}</p>
      <p className="mt-1 text-sm text-stone-500">
        {place.averageRating.toFixed(1)} avg · {place.reviewCount.toLocaleString()} reviews ·{" "}
        <span className="font-medium text-stone-700">{priceLabel}</span>
        <span className="text-stone-400"> · {place.category}</span>
      </p>

      <div className="mt-6">
        <h4 className="text-xs font-medium uppercase tracking-wider text-stone-500">Recent review pulse</h4>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{place.recentReviewSummary}</p>
      </div>

      <div className="mt-6">
        <h4 className="text-xs font-medium uppercase tracking-wider text-stone-500">Themes in reviews</h4>
        <ul className="mt-3 flex flex-wrap gap-2">
          {place.reviewThemes.map((t) => (
            <li
              key={t.id}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${sentimentStyles(t.sentiment)}`}
            >
              <span>{t.label}</span>
              <span className="tabular-nums opacity-70">{t.strength}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-rose-600">Common complaints</h4>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-stone-700">
            {place.complaints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-emerald-700">Positives</h4>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-stone-700">
            {place.positives.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
