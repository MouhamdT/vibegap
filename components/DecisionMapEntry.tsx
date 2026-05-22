"use client";

import { useMemo, useState } from "react";
import { DecisionMapModal } from "@/components/DecisionMapModal";
import { getBrowserGoogleMapId, getBrowserGoogleMapsApiKey } from "@/lib/maps/googleMapsEnv";
import type { DecisionMapPin } from "@/lib/maps/decisionMapModel";

export type DecisionMapEntryProps = {
  canRender: boolean;
  pins: DecisionMapPin[];
  title: string;
  subtitle: string;
  mapMode: "recommendation" | "single" | "compare";
  onSelectVenueId?: (venuePlaceId: string) => void;
  footerPrimaryLine?: string | null;
  /** Button label; defaults to “Decision map”. */
  label?: string;
};

export function DecisionMapEntry(props: DecisionMapEntryProps) {
  const [open, setOpen] = useState(false);
  const apiKey = useMemo(() => getBrowserGoogleMapsApiKey(), []);
  const mapId = useMemo(() => getBrowserGoogleMapId(), []);

  if (!props.canRender) return null;

  const missingKey = !apiKey;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={missingKey}
          onClick={() => {
            if (!missingKey) setOpen(true);
          }}
          className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold tracking-wide transition ${
            missingKey
              ? "cursor-not-allowed border-stone-200/80 bg-stone-100 text-stone-400"
              : "border-stone-200/80 bg-white text-stone-800 hover:border-stone-300/90 hover:bg-stone-50"
          }`}
        >
          {props.label ?? "Decision map"}
        </button>
        {missingKey ? (
          <span className="max-w-[16rem] text-[10px] leading-snug text-stone-400">
            Map unavailable — missing Maps JavaScript key.
          </span>
        ) : null}
      </div>

      {!missingKey ? (
        <DecisionMapModal
          open={open}
          onClose={() => setOpen(false)}
          apiKey={apiKey}
          mapId={mapId}
          pins={props.pins}
          title={props.title}
          subtitle={props.subtitle}
          mapMode={props.mapMode}
          onSelectVenueId={props.onSelectVenueId}
          footerPrimaryLine={props.footerPrimaryLine}
        />
      ) : null}
    </>
  );
}
