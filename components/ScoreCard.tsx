export type ScoreCardProps = {
  label: string;
  value: number;
  /** Upper bound for display (default 100). */
  max?: number;
  hint?: string;
  /** Larger typography for the primary VibeGap score. */
  emphasis?: boolean;
};

export function ScoreCard({ label, value, max = 100, hint, emphasis = false }: ScoreCardProps) {
  const clamped = Math.min(max, Math.max(0, value));
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-sm ${
        emphasis ? "p-6 ring-1 ring-stone-900/5" : "p-5"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p
        className={`mt-2 font-semibold tracking-tight text-stone-900 tabular-nums ${
          emphasis ? "text-4xl" : "text-2xl"
        }`}
      >
        {Math.round(clamped)}
        <span className={`font-normal text-stone-400 ${emphasis ? "text-lg" : "text-sm"}`}>
          /{max}
        </span>
      </p>
      {hint ? (
        <p className={`mt-2 text-stone-600 ${emphasis ? "text-sm" : "text-xs"} leading-relaxed`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
