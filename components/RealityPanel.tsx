import type { PlaceData } from "@/lib/types/vibecheck";

export type RealityPanelProps = {
  place: PlaceData;
  summary: string;
};

export function RealityPanel({ place, summary }: RealityPanelProps) {
  return (
    <section
      className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm"
      aria-labelledby="reality-heading"
    >
      <h3 id="reality-heading" className="text-sm font-medium uppercase tracking-wider text-stone-500">
        Review reality
      </h3>
      <p className="mt-2 text-lg font-semibold tracking-tight text-stone-900">{place.name}</p>
      <p className="mt-1 text-sm text-stone-500">
        {place.averageRating.toFixed(1)} avg · {place.reviewCount.toLocaleString()} reviews
      </p>
      <p className="mt-4 text-sm leading-relaxed text-stone-700">{summary}</p>
    </section>
  );
}
