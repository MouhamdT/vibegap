"use client";

import { useMemo } from "react";
import { DecisionMapEntry } from "@/components/DecisionMapEntry";
import { singlePlaceMapPins } from "@/lib/maps/decisionMapModel";
import { placeHasCoordinates } from "@/lib/maps/placeCoordinates";
import { getBrowserGoogleMapsApiKey } from "@/lib/maps/googleMapsEnv";
import type { VibeReport } from "@/lib/types/vibecheck";

export function VibeReportDecisionMap({ report }: { report: VibeReport }) {
  const canRender = placeHasCoordinates(report.place);
  const pins = useMemo(
    () => singlePlaceMapPins(report.place, report.geography ?? null, report.decision.label),
    [report.place, report.geography, report.decision.label],
  );

  const apiKey = useMemo(() => getBrowserGoogleMapsApiKey(), []);

  if (!canRender) {
    return <p className="text-[11px] text-stone-500">Map unavailable for this result.</p>;
  }

  if (!apiKey) {
    return <p className="text-[11px] text-stone-500">Map unavailable — add a Maps JavaScript API key to open the pin.</p>;
  }

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
