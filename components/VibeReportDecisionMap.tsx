"use client";

import { useMemo } from "react";
import { DecisionMapEntry } from "@/components/DecisionMapEntry";
import { singlePlaceMapPins } from "@/lib/maps/decisionMapModel";
import { placeHasCoordinates } from "@/lib/maps/placeCoordinates";
import type { VibeReport } from "@/lib/types/vibecheck";

export function VibeReportDecisionMap({ report }: { report: VibeReport }) {
  const canRender = placeHasCoordinates(report.place);
  const pins = useMemo(
    () => singlePlaceMapPins(report.place, report.geography ?? null, report.decision.label),
    [report.place, report.geography, report.decision.label],
  );

  if (!canRender) return null;

  return (
    <div className="pt-1">
      <DecisionMapEntry
        canRender={canRender}
        pins={pins}
        title="Map context"
        subtitle={report.place.name}
        mapMode="single"
        footerPrimaryLine={`${report.place.averageRating.toFixed(1)} / 5 · ${report.decision.label}`}
      />
    </div>
  );
}
