"use client";

type AnalysisStatusLineProps = {
  activePhase: number;
};

const PHASES = [
  { key: "find", label: "Finding places" },
  { key: "read", label: "Reading reviews" },
  { key: "score", label: "Scoring fit" },
] as const;

export function AnalysisStatusLine({ activePhase }: AnalysisStatusLineProps) {
  const active = ((activePhase % PHASES.length) + PHASES.length) % PHASES.length;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-[12px] leading-snug text-stone-500"
    >
      {PHASES.map((phase, i) => (
        <span key={phase.key} className="inline-flex items-center">
          {i > 0 ? <span className="px-1 text-stone-300 select-none" aria-hidden>·</span> : null}
          <span className={active === i ? "font-medium text-stone-800" : ""}>{phase.label}</span>
        </span>
      ))}
    </div>
  );
}
