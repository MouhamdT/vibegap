"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  TUNABLE_PRIORITY_KEYS,
  TUNABLE_SLIDER_HINTS,
  TUNABLE_SLIDER_LABELS,
  type PriorityWeights,
  type TunablePriorityKey,
} from "@/lib/ai/priorityTuning";
import { PRODUCT_HONESTY_COMPARE, PRODUCT_HONESTY_FULL } from "@/lib/copy/productHonesty";

function mergeAtmosphere(next: PriorityWeights, defaultWeights: PriorityWeights): PriorityWeights {
  return { ...next, atmosphere: defaultWeights.atmosphere };
}

type PriorityTuningPanelProps = {
  weights: PriorityWeights;
  defaultWeights: PriorityWeights;
  onWeightsChange: (next: PriorityWeights) => void;
  onReset: () => void;
  /** Shown only after the user has changed a slider (keep short). */
  rankingNote: string | null;
  winnerUpdatedNote?: string | null;
  /** Small hint under the button (e.g. Detected vs Custom priorities). */
  prioritiesSubLabel?: string;
  variant?: "recommendation" | "compare";
  /** Overrides trigger + dialog title when set (e.g. “Tune comparison”). */
  tuneActionLabel?: string;
  /** First line inside the popover (ranking vs comparison wording). */
  panelIntroLine?: string;
  sliderLabels?: Partial<Record<TunablePriorityKey, string>>;
  sliderHints?: Partial<Record<TunablePriorityKey, string>>;
};

export function PriorityTuningPanel({
  weights,
  defaultWeights,
  onWeightsChange,
  onReset,
  rankingNote,
  winnerUpdatedNote,
  prioritiesSubLabel,
  variant = "recommendation",
  tuneActionLabel,
  panelIntroLine,
  sliderLabels,
  sliderHints,
}: PriorityTuningPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const actionLabel =
    tuneActionLabel ?? (variant === "compare" ? "Tune comparison" : "Tune ranking");
  const dialogTitle = actionLabel;
  const defaultIntro =
    variant === "compare"
      ? "Comparison updates locally."
      : "Rankings update locally.";
  const introLine = panelIntroLine ?? defaultIntro;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const handleSliderChange = (key: TunablePriorityKey, value: number) => {
    onWeightsChange(mergeAtmosphere({ ...weights, [key]: value }, defaultWeights));
  };

  const labelFor = (key: TunablePriorityKey) => sliderLabels?.[key] ?? TUNABLE_SLIDER_LABELS[key];
  const hintFor = (key: TunablePriorityKey) => sliderHints?.[key] ?? TUNABLE_SLIDER_HINTS[key];

  return (
    <div ref={rootRef} className="flex w-full min-w-0 flex-col gap-0.5 self-start sm:items-end lg:ml-auto">
      <div className="relative w-full min-w-0 sm:w-fit sm:max-w-full sm:shrink-0 sm:self-end">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex w-fit max-w-full shrink-0 items-center gap-1 rounded-md border border-stone-200/70 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-800 shadow-sm transition hover:border-stone-300 hover:bg-stone-50/90"
        >
          <span className="whitespace-nowrap">{actionLabel}</span>
          <span className="text-stone-400" aria-hidden>
            {open ? "▴" : "▾"}
          </span>
        </button>

        {prioritiesSubLabel ? (
          <p className="mt-0.5 text-[9px] font-medium text-stone-500 sm:text-right">{prioritiesSubLabel}</p>
        ) : null}

        {open ? (
          <div
            id={panelId}
            className="mt-2 w-full max-w-none rounded-lg border border-stone-200/70 bg-white p-3 shadow-md sm:max-w-none lg:absolute lg:right-0 lg:top-[calc(100%+8px)] lg:z-[80] lg:mt-0 lg:w-[clamp(320px,28vw,380px)] lg:min-w-[320px] lg:max-w-[380px] lg:p-3 lg:shadow-lg"
            role="dialog"
            aria-label={dialogTitle}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-2">
              <p className="text-sm font-semibold tracking-tight text-stone-950 whitespace-nowrap">{dialogTitle}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
              {introLine}{" "}
              {variant === "compare" ? PRODUCT_HONESTY_COMPARE : PRODUCT_HONESTY_FULL}
            </p>

            <div className="mt-2.5 space-y-2">
              {TUNABLE_PRIORITY_KEYS.map((key) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-stone-700">
                    <label
                      htmlFor={`${panelId}-${key}`}
                      className="min-w-0 font-medium"
                      title={hintFor(key)}
                    >
                      {labelFor(key)}
                    </label>
                    <span className="shrink-0 tabular-nums text-stone-500">{weights[key]}</span>
                  </div>
                  <input
                    id={`${panelId}-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weights[key]}
                    onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                    className="vibegap-tune-range h-1.5 w-full min-w-0 cursor-pointer accent-stone-700"
                    title={hintFor(key)}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="mt-3 text-[11px] font-medium text-stone-600 underline decoration-stone-300 underline-offset-2 hover:text-stone-900"
            >
              Reset to detected goal
            </button>

            {rankingNote ? (
              <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-500" role="status">
                {rankingNote}
              </p>
            ) : null}
            {winnerUpdatedNote ? (
              <p className="mt-1.5 text-[10px] font-medium leading-snug text-stone-600" role="status">
                {winnerUpdatedNote}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
