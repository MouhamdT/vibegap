"use client";

import { useState } from "react";
import { buildReviewEvidence } from "@/lib/ai/reviewEvidence";
import { REVIEW_EVIDENCE_HONESTY } from "@/lib/copy/productHonesty";
import type { PlaceData } from "@/lib/types/vibecheck";

type ReviewEvidencePanelProps = {
  place: PlaceData;
  variant?: "full" | "compact";
  /** When false, omit the footer honesty line (parent can show a single line instead). Default true. */
  showDataHonesty?: boolean;
};

const HONESTY = REVIEW_EVIDENCE_HONESTY;

const SNIPPET_UNAVAILABLE =
  "Representative review snippets are not available for this venue. This view uses detected review themes instead.";

function snippetKindLabel(): string {
  return "Available review snippet";
}

export function ReviewEvidencePanel({
  place,
  variant = "full",
  showDataHonesty = true,
}: ReviewEvidencePanelProps) {
  const evidence = buildReviewEvidence(place);
  const compact = variant === "compact";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const themeRows = compact ? evidence.themes.slice(0, 4) : evidence.themes.slice(0, 8);
  const helpedRows = compact ? evidence.helped.slice(0, 2) : evidence.helped.slice(0, 4);
  const hurtRows = compact ? evidence.hurt.slice(0, 2) : evidence.hurt.slice(0, 4);
  const snippetRows = compact ? evidence.snippets.slice(0, 1) : evidence.snippets;

  const textXs = compact ? "text-[10px]" : "text-[11px]";
  const text2xs = compact ? "text-[9px]" : "text-[10px]";
  const pad = compact ? "px-2.5 py-2" : "px-3 py-2.5";

  return (
    <details
      className={
        compact
          ? "rounded-md border border-stone-100 bg-stone-50/50"
          : "rounded-md border border-stone-200/60 bg-white"
      }
    >
      <summary
        className={`cursor-pointer list-none ${pad} text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500 outline-none marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span>Review evidence</span>
          <span className="font-normal normal-case tracking-normal text-stone-400">Why reviewers say this</span>
        </span>
      </summary>

      <div className={`space-y-3 border-t border-stone-100 ${compact ? "px-2.5 pb-2.5 pt-2" : "px-3 pb-3 pt-2"}`}>
        <p className={`${text2xs} font-medium uppercase tracking-[0.1em] text-stone-400`}>Review signals</p>

        {!evidence.hasStructuredEvidence ? (
          <p className={`${textXs} leading-relaxed text-stone-600`}>
            Limited structured review evidence is available for this venue in the current snapshot.
          </p>
        ) : null}

        {themeRows.length > 0 ? (
          <div>
            <p className={`${text2xs} font-medium text-stone-500`}>Review themes</p>
            <ul className={`mt-1.5 flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
              {themeRows.map((row) => (
                <li
                  key={row.id}
                  className={`inline-flex max-w-full items-center gap-1 rounded-full border border-stone-200/80 bg-stone-50/80 ${compact ? "px-1.5 py-0.5" : "px-2 py-0.5"} ${textXs} text-stone-700`}
                >
                  <span className="min-w-0 truncate font-medium text-stone-800">{row.label}</span>
                  <span className="shrink-0 text-stone-500">{row.level}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {helpedRows.length > 0 ? (
          <div>
            <p className={`${text2xs} font-medium text-stone-500`}>Helped the score</p>
            <ul className={`mt-1.5 space-y-1 ${textXs} leading-relaxed text-stone-700`}>
              {helpedRows.map((line, i) => (
                <li key={`h-${i}`} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/90" aria-hidden />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hurtRows.length > 0 ? (
          <div>
            <p className={`${text2xs} font-medium text-stone-500`}>Watch-outs</p>
            <ul className={`mt-1.5 space-y-1 ${textXs} leading-relaxed text-stone-700`}>
              {hurtRows.map((line, i) => (
                <li key={`r-${i}`} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400/90" aria-hidden />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {snippetRows.length > 0 ? (
          <div>
            <p className={`${text2xs} font-medium text-stone-500`}>Sample snippets</p>
            <ul className="mt-1.5 space-y-2">
              {snippetRows.map((sn) => {
                const isOpen = expanded[sn.id];
                const showFull = isOpen || !sn.canExpand;
                const body = showFull ? sn.full : sn.preview;
                return (
                  <li key={sn.id} className="rounded-md border border-stone-100 bg-stone-50/40 px-2 py-1.5">
                    <p className={`${text2xs} text-stone-400`}>{snippetKindLabel()}</p>
                    <p className={`mt-1 ${textXs} leading-relaxed text-stone-700`}>{body}</p>
                    {sn.canExpand ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpanded((prev) => ({ ...prev, [sn.id]: !isOpen }));
                        }}
                        className={`mt-1 ${text2xs} font-medium text-stone-600 underline decoration-stone-300 underline-offset-2 hover:text-stone-900`}
                      >
                        {isOpen ? "Show less" : "Show more"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : evidence.showSnippetFallbackNote ? (
          <p className={`${textXs} leading-relaxed text-stone-600`}>{SNIPPET_UNAVAILABLE}</p>
        ) : null}

        {showDataHonesty ? <p className={`${text2xs} leading-snug text-stone-400`}>{HONESTY}</p> : null}
      </div>
    </details>
  );
}
