"use client";

const DATA_HONESTY =
  "Venue details and review signals come from Google Places when available. Social comparison is illustrative in this prototype and should not be treated as live social media data.";

const STEPS: readonly { title: string; body: string }[] = [
  {
    title: "Intent parsing",
    body: "Converts the search into a visit goal — quiet study, budget dinner, low-wait visit, brunch, vegan, special occasion, and similar patterns.",
  },
  {
    title: "Candidate generation",
    body: "Uses Google Places to resolve a specific venue or a ranked shortlist around a city, neighborhood, or landmark anchor.",
  },
  {
    title: "Review signal extraction",
    body: "Surfaces repeated review themes: wait time, noise, crowding, value, food quality, ambience, seating, and reservation friction.",
  },
  {
    title: "Goal-weighted scoring",
    body: "Applies a goal-specific decision framework — not stars alone. Weights shift by goal (e.g. study favors calm signals; celebrations favor group fit and reservation risk).",
  },
  {
    title: "Decision output",
    body: "Maps fit score and signal confidence into GO, MAYBE, or SKIP with a clear tradeoff explanation.",
  },
] as const;

const GOAL_WEIGHTS: readonly { goal: string; bullets: readonly string[] }[] = [
  { goal: "Quiet study", bullets: ["Noise / crowding risk", "Seating & laptop fit", "Review strength"] },
  { goal: "Budget dinner", bullets: ["Price / value fit", "Group practicality", "Wait / reservation risk"] },
  { goal: "Special occasion", bullets: ["Ambience / reputation", "Review strength", "Reservation pressure"] },
  { goal: "Low-wait", bullets: ["Line / wait mentions", "Reservation friction", "Timing flexibility"] },
] as const;

function MethodologyInner({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-5 text-left ${className}`}>
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">How VibeGap scores a place</h3>
        <ol className="mt-3 space-y-2.5 border-l border-stone-200/80 pl-3.5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="text-[12px] leading-snug text-stone-700">
              <span className="font-medium text-stone-900">
                {i + 1}. {step.title}
              </span>
              <span className="text-stone-600"> — {step.body}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-md border border-stone-200/60 bg-stone-50/40 px-3 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Weighted scoring</p>
        <p className="mt-2 text-[12px] leading-relaxed text-stone-700">
          VibeGap does not rank by star rating alone. The model adjusts for your goal — for example, a 4.7 café can rank lower for studying if reviews
          repeatedly mention noise, crowds, or limited seating.
        </p>
        <ul className="mt-3 space-y-2 border-t border-stone-200/50 pt-3 text-[11px] leading-snug text-stone-600">
          {GOAL_WEIGHTS.map((row) => (
            <li key={row.goal}>
              <span className="font-medium text-stone-800">{row.goal}:</span> {row.bullets.join(" · ")}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">In your report</p>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-stone-600">
          <li>
            <span className="font-medium text-stone-800">Intent Fit</span> — goal match from review-derived signals.
          </li>
          <li>
            <span className="font-medium text-stone-800">VibeGap</span> — mismatch between mock social tone and review reality (illustrative social only).
          </li>
          <li>
            <span className="font-medium text-stone-800">Confidence</span> — strength of available Google review signals.
          </li>
          <li>
            <span className="font-medium text-stone-800">GO / MAYBE / SKIP</span> — risk-adjusted recommendation from fit plus tradeoffs.
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-dashed border-stone-200/70 px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">Data honesty</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600">{DATA_HONESTY}</p>
      </div>
    </div>
  );
}

/** One-line preview + collapsible methodology on the empty landing state. */
export function MethodologyLandingPreview() {
  return (
    <div className="w-full max-w-xl px-1 sm:max-w-2xl">
      <p className="text-center text-[11px] leading-relaxed text-stone-500">
        Built as a decision analytics MVP: intent parsing → review signals → weighted scoring → explainable recommendation.
      </p>
      <details className="mt-3 rounded-lg border border-stone-200/50 bg-white/50 px-3 py-2.5 text-left sm:px-4">
        <summary className="cursor-pointer list-none text-center text-[11px] font-medium text-stone-700 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-stone-300 underline-offset-4 hover:text-stone-900">View methodology</span>
        </summary>
        <MethodologyInner className="mt-4 border-t border-stone-100 pt-4" />
      </details>
    </div>
  );
}

/** Collapsed-by-default methodology after results (recommendation or single-place). */
export function MethodologyAfterResults() {
  return (
    <details className="mt-1 rounded-lg border border-stone-200/50 bg-white/60 px-4 py-3 sm:px-5">
      <summary className="cursor-pointer list-none text-[11px] font-medium text-stone-800 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="underline decoration-stone-300 underline-offset-4 hover:text-stone-950">How scoring works</span>
        <span className="ml-2 font-normal text-stone-500">— methodology and data honesty</span>
      </summary>
      <MethodologyInner className="mt-4 border-t border-stone-100 pt-4" />
    </details>
  );
}
