export type ScoreCardProps = {
  label: string;
  value: number;
  /** Upper bound for display (default 100). */
  max?: number;
  hint?: string;
  /** Larger typography for the primary signal-gap score card. */
  emphasis?: boolean;
};

export function ScoreCard({ label, value, max = 100, hint, emphasis = false }: ScoreCardProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const tenScale = (Math.round((clamped / max) * 100) / 10).toFixed(1);
  return (
    <div
      className={`rounded-xl border border-stone-100 bg-white ${
        emphasis ? "p-5 ring-1 ring-stone-900/[0.03]" : "p-4"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">{label}</p>
      <p
        className={`mt-2 font-semibold tracking-tight text-stone-900 tabular-nums ${
          emphasis ? "text-4xl" : "text-2xl"
        }`}
      >
        {tenScale}
        <span className={`font-normal text-stone-400 ${emphasis ? "text-lg" : "text-sm"}`}>
          /10
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
