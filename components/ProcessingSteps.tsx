export type ProcessingStep = {
  id: string;
  label: string;
  description?: string;
};

export const VIBECHECK_STEPS: ProcessingStep[] = [
  { id: "1", label: "Locating place", description: "Resolving the best place match for your search." },
  { id: "2", label: "Scanning social hype", description: "Using mock social signals for this prototype." },
  { id: "3", label: "Reading review reality", description: "Reading available place/review signals." },
  { id: "4", label: "Scoring the gap", description: "Applying transparent rule-based heuristics." },
];

export type ProcessingStepsStatus = "idle" | "loading" | "success";

export type ProcessingStepsProps = {
  steps?: ProcessingStep[];
  status?: ProcessingStepsStatus;
  /** While loading, highlights the active step (\"1\"–\"4\"). Ignored when status is not loading. */
  activeStepId?: string;
};

export function ProcessingSteps({
  steps = VIBECHECK_STEPS,
  status = "idle",
  activeStepId,
}: ProcessingStepsProps) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live={status === "loading" ? "polite" : "off"}>
      {steps.map((step, index) => {
        const isActive = status === "loading" && activeStepId === step.id;
        const isDone =
          status === "success" ||
          (status === "loading" && activeStepId && Number(step.id) < Number(activeStepId));

        const base =
          "rounded-2xl border px-4 py-4 transition motion-safe:transition-colors motion-reduce:transition-none";

        const stateClass =
          isActive
            ? "border-stone-900 bg-stone-900 text-white shadow-md"
            : isDone
              ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-950 shadow-sm"
              : "border-stone-200/80 bg-white/80 text-stone-600 shadow-sm";

        return (
          <li key={step.id} className={`${base} ${stateClass}`}>
            <span
              className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                isActive
                  ? "bg-white/15 text-white"
                  : isDone
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-stone-100 text-stone-500"
              }`}
            >
              {status === "success" || isDone ? "✓" : index + 1}
            </span>
            <p className={`font-medium leading-snug ${isActive ? "text-white" : "text-stone-900"}`}>
              {step.label}
            </p>
            {step.description ? (
              <p
                className={`mt-1 text-sm leading-relaxed ${
                  isActive ? "text-stone-200" : isDone ? "text-emerald-900/80" : "text-stone-500"
                }`}
              >
                {step.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
