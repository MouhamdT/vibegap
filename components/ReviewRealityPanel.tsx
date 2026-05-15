"use client";

import { buildReviewReality } from "@/lib/ai/reviewReality";
import type { DetectedIntent, PlaceData } from "@/lib/types/vibecheck";

type ReviewRealityPanelProps = {
  place: PlaceData;
  intent?: DetectedIntent;
  variant?: "full" | "compact";
};

export function ReviewRealityPanel({ place, intent, variant = "full" }: ReviewRealityPanelProps) {
  const reality = buildReviewReality(place, intent);
  const compact = variant === "compact";

  return (
    <section
      className={compact ? "space-y-2" : "rounded-lg border border-stone-200/60 bg-white px-3.5 py-3 sm:px-4 sm:py-3.5"}
      aria-label="Review Reality"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">Review Reality</p>

      <div className="mt-2 space-y-2.5">
        <div>
          <p className="text-[10px] font-medium text-stone-500">Main signal</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-stone-700">{reality.mainSignal}</p>
        </div>

        {!compact ? (
          <>
            <div>
              <p className="text-[10px] font-medium text-stone-500">Positive signals</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{reality.positiveSignals.join(" · ")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-stone-500">Risk signals</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{reality.riskSignals.join(" · ")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-stone-500">Decision meaning</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{reality.decisionMeaning}</p>
            </div>
          </>
        ) : null}

        {reality.signalStrengths.length > 0 && !compact ? (
          <ul className="space-y-1 border-t border-stone-100 pt-2">
            {reality.signalStrengths.map((line) => (
              <li key={line.label} className="flex items-baseline justify-between gap-2 text-[10px] text-stone-600">
                <span className="font-medium text-stone-800">{line.label}</span>
                <span className="shrink-0 text-stone-500">{line.strengthLabel}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className={compact ? "" : "border-t border-stone-100 pt-2"}>
          <p className="text-[10px] font-medium text-stone-500">Decision impact</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-700">{reality.decisionImpact}</p>
        </div>

        <details className="rounded-md border border-stone-100 bg-stone-50/40 px-2.5 py-2">
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500">
            Review receipts
          </summary>
          <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
            {reality.receipts.length > 0 ? (
              <ul className="space-y-2 text-[10px] leading-relaxed text-stone-600">
                {reality.receipts.map((quote) => (
                  <li key={quote} className="border-l-2 border-stone-200 pl-2">
                    &ldquo;{quote}&rdquo;
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] leading-relaxed text-stone-600">{reality.receiptsHonestyNote}</p>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
