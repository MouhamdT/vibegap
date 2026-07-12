"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMapsScript } from "@/lib/maps/loadGoogleMapsScript";
import { getBrowserGoogleMapId, getBrowserGoogleMapsApiKey } from "@/lib/maps/googleMapsEnv";
import { formatDistance } from "@/lib/geo/distance";

export type MiniMapStopPin = {
  stopNumber: number;
  name: string;
  lat: number;
  lng: number;
};

export type VisitPlanMiniMapProps = {
  anchorName: string;
  anchorLat: number | null;
  anchorLng: number | null;
  stopPins: MiniMapStopPin[];
  /** Straight-line meters between stop 1 and stop 2 when both are locked. */
  routeDistanceMeters: number | null;
  className?: string;
};

type MiniMapsModule = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => {
    fitBounds: (bounds: unknown, padding?: number | Record<string, unknown>) => void;
    setCenter: (c: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
  };
  LatLngBounds: new () => { extend: (p: { lat: number; lng: number }) => void };
  Polyline?: new (opts: Record<string, unknown>) => { setMap: (m: unknown | null) => void };
  importLibrary?: (name: string) => Promise<Record<string, unknown>>;
};

type MiniAdvancedMarkerCtor = new (opts: {
  map: unknown;
  position: { lat: number; lng: number };
  content: HTMLElement;
}) => { map: unknown };

function stopPinElement(stopNumber: number): HTMLElement {
  const root = document.createElement("div");
  const pill = document.createElement("div");
  pill.style.cssText =
    "box-sizing:border-box;min-width:26px;height:26px;padding:0 6px;border-radius:999px;display:flex;align-items:center;justify-content:center;" +
    "font:700 11px ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;background:#1c1917;color:#fafaf9;border:2px solid #fafaf9;" +
    "box-shadow:0 6px 14px rgba(28,25,23,0.22)";
  pill.textContent = String(stopNumber);
  root.appendChild(pill);
  return root;
}

function anchorPinElement(): HTMLElement {
  const root = document.createElement("div");
  const pill = document.createElement("div");
  pill.style.cssText =
    "box-sizing:border-box;min-width:20px;height:20px;padding:0 4px;border-radius:7px;display:flex;align-items:center;justify-content:center;" +
    "font:600 10px ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;background:#f5f5f4;color:#78716c;border:1px dashed #d6d3d1;" +
    "box-shadow:0 4px 10px rgba(28,25,23,0.10)";
  pill.textContent = "◎";
  root.appendChild(pill);
  return root;
}

/**
 * Always-visible small route map for plan mode: numbered stop pins, quiet anchor pin,
 * and a straight polyline between locked stops. Renders nothing without a Maps key.
 */
export function VisitPlanMiniMap({
  anchorName,
  anchorLat,
  anchorLng,
  stopPins,
  routeDistanceMeters,
  className = "",
}: VisitPlanMiniMapProps) {
  const apiKey = useMemo(() => getBrowserGoogleMapsApiKey(), []);
  const mapId = useMemo(() => getBrowserGoogleMapId(), []);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  const hasAnchor = typeof anchorLat === "number" && typeof anchorLng === "number";
  const geometryKey = useMemo(
    () =>
      JSON.stringify({
        a: hasAnchor ? [anchorLat, anchorLng] : null,
        s: stopPins.map((p) => [p.stopNumber, p.lat, p.lng]),
      }),
    [hasAnchor, anchorLat, anchorLng, stopPins],
  );

  const canRender = Boolean(apiKey) && (hasAnchor || stopPins.length > 0);

  useEffect(() => {
    if (!canRender || !apiKey) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const run = async () => {
      try {
        await loadGoogleMapsScript(apiKey);
        if (cancelled || !hostRef.current) return;

        const maps = window.google?.maps as unknown as MiniMapsModule | undefined;
        if (!maps?.Map) throw new Error("maps unavailable");

        let MarkerCtor: MiniAdvancedMarkerCtor | null = null;
        if (typeof maps.importLibrary === "function") {
          const lib = (await maps.importLibrary("marker")) as Record<string, unknown>;
          if (typeof lib.AdvancedMarkerElement === "function") {
            MarkerCtor = lib.AdvancedMarkerElement as MiniAdvancedMarkerCtor;
          }
        }
        if (!MarkerCtor || cancelled || !hostRef.current) throw new Error("markers unavailable");

        host.innerHTML = "";
        const points: { lat: number; lng: number }[] = [];

        const map = new maps.Map(host, {
          mapId,
          center: hasAnchor ? { lat: anchorLat!, lng: anchorLng! } : { lat: stopPins[0]!.lat, lng: stopPins[0]!.lng },
          zoom: 13,
          disableDefaultUI: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });

        if (hasAnchor) {
          const m = new MarkerCtor({
            map,
            position: { lat: anchorLat!, lng: anchorLng! },
            content: anchorPinElement(),
          });
          cleanups.push(() => {
            m.map = null;
          });
          points.push({ lat: anchorLat!, lng: anchorLng! });
        }

        const ordered = [...stopPins].sort((a, b) => a.stopNumber - b.stopNumber);
        for (const pin of ordered) {
          const m = new MarkerCtor({
            map,
            position: { lat: pin.lat, lng: pin.lng },
            content: stopPinElement(pin.stopNumber),
          });
          cleanups.push(() => {
            m.map = null;
          });
          points.push({ lat: pin.lat, lng: pin.lng });
        }

        if (ordered.length >= 2 && typeof maps.Polyline === "function") {
          const line = new maps.Polyline({
            map,
            path: ordered.map((p) => ({ lat: p.lat, lng: p.lng })),
            strokeColor: "#1c1917",
            strokeOpacity: 0.55,
            strokeWeight: 2.5,
          });
          cleanups.push(() => line.setMap(null));
        }

        if (points.length === 1) {
          map.setCenter(points[0]!);
          map.setZoom(14);
        } else if (points.length > 1) {
          const bounds = new maps.LatLngBounds();
          points.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, 40);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void run();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore teardown errors
        }
      });
      host.innerHTML = "";
    };
  }, [canRender, apiKey, mapId, geometryKey, hasAnchor, anchorLat, anchorLng, stopPins]);

  if (!canRender || failed) return null;

  return (
    <div className={`overflow-hidden rounded-lg border border-stone-200/70 bg-stone-50 ${className}`}>
      <div className="relative h-44 w-full sm:h-52">
        <div ref={hostRef} className="h-full w-full" />
        {routeDistanceMeters != null && Number.isFinite(routeDistanceMeters) ? (
          <span className="absolute left-2 top-2 rounded-full border border-stone-200/90 bg-white/95 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-stone-800 shadow-sm">
            ~{formatDistance(routeDistanceMeters)} between stops
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-2.5 py-1.5">
        <p className="min-w-0 truncate text-[10px] font-medium text-stone-500">Near {anchorName}</p>
        <p className="shrink-0 text-[9px] text-stone-400">Distances are approximate.</p>
      </div>
    </div>
  );
}
