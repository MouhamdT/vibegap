import type { RankedCandidate } from "@/lib/types/vibecheck";

type CandidateCardProps = {
  candidate: RankedCandidate;
};

export function CandidateCard({ candidate }: CandidateCardProps) {
  const tone =
    candidate.decision.label === "GO"
      ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-900"
      : candidate.decision.label === "SKIP"
        ? "border-rose-200/80 bg-rose-50/60 text-rose-900"
        : "border-amber-200/80 bg-amber-50/60 text-amber-900";

  return (
    <article className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tone}`}>
          {candidate.decision.label}
        </span>
        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700">
          Confidence: {candidate.decision.confidence}
        </span>
        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700">
          Fit: {candidate.fitScore}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold tracking-tight text-stone-900">{candidate.place.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">{candidate.place.address}</p>
      <p className="mt-2 text-xs text-stone-500">
        <span className="font-medium text-stone-700">{candidate.place.averageRating.toFixed(1)}</span> / 5 ·{" "}
        {candidate.place.reviewCount.toLocaleString()} reviews ·{" "}
        <span className="font-medium text-stone-700">{"$".repeat(candidate.place.priceLevel)}</span>
      </p>

      <p className="mt-3 text-sm leading-relaxed text-stone-700">{candidate.oneSentenceReason}</p>
      <p className="mt-2 text-xs leading-relaxed text-stone-500">
        <span className="font-medium text-stone-700">Main risk:</span> {candidate.mainRisk}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        <span className="font-medium text-stone-700">Best for:</span> {candidate.bestFor}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        <span className="font-medium text-stone-700">Avoid if:</span> {candidate.avoidIf}
      </p>
      <p className="mt-3 text-[11px] text-stone-400">
        Google Places data · {candidate.place.hasRealGoogleReviews ? "Google review signals" : "limited review signals"} ·
        {" "}Mock social signals
      </p>

      <button
        type="button"
        className="mt-4 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
      >
        Check full VibeGap
      </button>
    </article>
  );
}
