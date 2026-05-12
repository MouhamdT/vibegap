import type { VibeGapScore } from "@/lib/types/vibecheck";

export type ScoreCardProps = {
  score: VibeGapScore;
};

export function ScoreCard({ score }: ScoreCardProps) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
        VibeGap score
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-stone-900 tabular-nums">
        {score.gapMagnitude}
        <span className="text-lg font-normal text-stone-400">/100</span>
      </p>
      <p className="mt-2 text-sm font-medium text-stone-800">{score.verdict}</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-100 pt-6 text-sm">
        <div>
          <dt className="text-stone-500">Hype index</dt>
          <dd className="mt-1 font-semibold tabular-nums text-stone-900">{score.hypeIndex}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Reality index</dt>
          <dd className="mt-1 font-semibold tabular-nums text-stone-900">{score.realityIndex}</dd>
        </div>
      </dl>
    </div>
  );
}
