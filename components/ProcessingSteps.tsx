export type ProcessingStep = {
  id: string;
  label: string;
  description?: string;
};

const DEFAULT_STEPS: ProcessingStep[] = [
  { id: "1", label: "Locate place", description: "Resolve the venue from your search." },
  { id: "2", label: "Scan social hype", description: "Sample how the place is talked about online." },
  { id: "3", label: "Read the room", description: "Aggregate what reviews actually report." },
  { id: "4", label: "Score the gap", description: "Compare narrative vs. reality." },
];

export type ProcessingStepsProps = {
  steps?: ProcessingStep[];
  activeStepId?: string;
};

export function ProcessingSteps({
  steps = DEFAULT_STEPS,
  activeStepId,
}: ProcessingStepsProps) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => {
        const active = activeStepId === step.id;
        return (
          <li
            key={step.id}
            className={`rounded-2xl border px-4 py-4 transition ${
              active
                ? "border-stone-900 bg-stone-900 text-white shadow-md"
                : "border-stone-200/80 bg-white/80 text-stone-700 shadow-sm"
            }`}
          >
            <span
              className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active ? "bg-white/15 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >
              {index + 1}
            </span>
            <p className="font-medium leading-snug">{step.label}</p>
            {step.description ? (
              <p
                className={`mt-1 text-sm leading-relaxed ${
                  active ? "text-stone-200" : "text-stone-500"
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
