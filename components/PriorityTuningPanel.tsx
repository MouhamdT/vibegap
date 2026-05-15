"use client";

import { useId, useState } from "react";
import { PRIORITY_KEYS, PRIORITY_LABELS, type PriorityWeights } from "@/lib/ai/priorityTuning";

type PriorityTuningPanelProps = {
  weights: PriorityWeights;
  onWeightsChange: (next: PriorityWeights) => void;
  onReset: () => void;
  changeMessage: string | null;
  winnerUpdatedNote?: string | null;
};

export function PriorityTuningPanel({
  weights,
  onWeightsChange,
  onReset,
  changeMessage,
  winnerUpdatedNote,
}: PriorityTuningPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-lg border border-stone-200/55 bg-stone-50/35 px-3 py-2.5 sm:px-3.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-900"
        >
          Adjust priorities
        </button>
      ) : (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Adjust priorities</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">
                  Based on available review signals. Rankings update locally; social comparison remains illustrative.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-[10px] font-medium text-stone-500 hover:text-stone-800"
              >
                Close
              </button>
            </div>

            <div id={panelId} className="space-y-2.5">
              {PRIORITY_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-stone-700">
                    <label htmlFor={`${panelId}-${key}`} className="min-w-0 font-medium">
                      {PRIORITY_LABELS[key]}
                    </label>
                    <span className="shrink-0 tabular-nums text-stone-600">{weights[key]}</span>
                  </div>
                  <input
                    id={`${panelId}-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weights[key]}
                    onChange={(e) => onWeightsChange({ ...weights, [key]: Number(e.target.value) })}
                    className="h-1 w-full cursor-pointer accent-stone-700"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onReset}
              className="text-[11px] font-medium text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900"
            >
              Reset to detected goal
            </button>

            {changeMessage ? (
              <p className="text-[11px] leading-relaxed text-stone-600" role="status">
                {changeMessage}
              </p>
            ) : null}
            {winnerUpdatedNote ? (
              <p className="text-[11px] font-medium leading-relaxed text-stone-700" role="status">
                {winnerUpdatedNote}
              </p>
            ) : null}
        </div>
      )}
    </div>
  );
}
