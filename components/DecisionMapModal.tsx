"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMapsScript } from "@/lib/maps/loadGoogleMapsScript";
import type { DecisionMapPin } from "@/lib/maps/decisionMapModel";
import { isAnchorPinId } from "@/lib/maps/decisionMapModel";

export type DecisionMapModalProps = {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  mapId: string;
  pins: DecisionMapPin[];
  title: string;
  subtitle: string;
  mapMode: "recommendation" | "single" | "compare";
  onSelectVenueId?: (venuePlaceId: string) => void;
  footerPrimaryLine?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type MapMode = DecisionMapModalProps["mapMode"];

function createPinShell(): { root: HTMLDivElement; pill: HTMLDivElement } {
  const root = document.createElement("div");
  root.style.cursor = "pointer";
  root.style.transform = "translateY(-2px)";

  const pill = document.createElement("div");
  pill.style.boxSizing = "border-box";
  pill.style.padding = "0 6px";
  pill.style.borderRadius = "999px";
  pill.style.display = "flex";
  pill.style.alignItems = "center";
  pill.style.justifyContent = "center";
  pill.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
  pill.style.fontSize = "11px";
  pill.style.fontWeight = "700";
  pill.style.boxShadow = "0 8px 18px rgba(28,25,23,0.14)";

  root.appendChild(pill);
  return { root, pill };
}

function styleMarkerPill(pill: HTMLElement, pin: DecisionMapPin, mapMode: MapMode): void {
  const isAnchor = pin.kind === "anchor";
  const isCompare = mapMode === "compare";

  const baseSize = pin.isSelected ? 34 : 28;
  const bg = isAnchor ? "#1c1917" : pin.isSelected ? "#292524" : "#ffffff";
  const fg = isAnchor || pin.isSelected ? "#fafaf9" : "#1c1917";
  const border = isAnchor ? "2px solid #78716c" : pin.isSelected ? "2px solid #1c1917" : "1px solid #d6d3d1";

  pill.style.minWidth = `${baseSize}px`;
  pill.style.height = `${baseSize}px`;
  pill.style.background = bg;
  pill.style.color = fg;
  pill.style.border = border;
  pill.style.borderRadius = isAnchor ? "10px" : "999px";

  if (isAnchor) {
    pill.textContent = "◎";
  } else if (isCompare) {
    pill.textContent = pin.kind === "compareA" ? "A" : pin.kind === "compareB" ? "B" : "?";
  } else if (typeof pin.rank === "number") {
    pill.textContent = String(pin.rank);
  } else {
    pill.textContent = "•";
  }
}

function anchorPopupHtml(pin: DecisionMapPin): string {
  return `<div style="max-width:280px;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#292524;padding:2px 4px 2px 0">
  <div style="font-weight:700;letter-spacing:-0.01em">${escapeHtml(pin.name)}</div>
  <div style="margin-top:6px;font-size:11px;color:#78716c">Anchor for this search</div>
</div>`;
}

function recommendationCandidatePopupHtml(pin: DecisionMapPin): string {
  const rank = typeof pin.rank === "number" ? `#${pin.rank}` : "";
  const titleLine = rank
    ? `<div style="font-weight:700;letter-spacing:-0.01em">${escapeHtml(rank)} ${escapeHtml(pin.name)}</div>`
    : `<div style="font-weight:700;letter-spacing:-0.01em">${escapeHtml(pin.name)}</div>`;

  const dec = pin.decisionLabel ? escapeHtml(pin.decisionLabel) : "—";
  const fit =
    typeof pin.fitScore === "number" && Number.isFinite(pin.fitScore)
      ? escapeHtml(`Fit ${Math.round(pin.fitScore)}`)
      : "";
  const decisionFit = fit ? `<span style="font-weight:700">${dec}</span> · ${fit}` : `<span style="font-weight:700">${dec}</span>`;

  const distRaw = pin.distanceFromAnchorLine;
  const distLine = distRaw ? escapeHtml(distRaw) : "";

  const riskRaw = pin.mainRisk?.trim();
  const riskLine = riskRaw ? `Risk: ${escapeHtml(riskRaw)}` : "";

  const distBlock = distLine
    ? `<div style="margin-top:6px;font-size:11px;color:#57534e;line-height:1.35">${distLine}</div>`
    : "";
  const riskBlock = riskLine
    ? `<div style="margin-top:5px;font-size:11px;color:#57534e;line-height:1.35">${riskLine}</div>`
    : "";

  return `<div style="max-width:280px;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#292524;padding:2px 4px 2px 0">
  ${titleLine}
  <div style="margin-top:6px;font-size:11px;color:#444;line-height:1.35">${decisionFit}</div>
  ${distBlock}
  ${riskBlock}
</div>`;
}

function singlePlacePopupHtml(pin: DecisionMapPin): string {
  const rating =
    typeof pin.rating === "number" && Number.isFinite(pin.rating) ? `${pin.rating.toFixed(1)} / 5` : "—";
  const dec = pin.decisionLabel ? escapeHtml(pin.decisionLabel) : "—";
  const dist = pin.distanceFromAnchorLine ? escapeHtml(pin.distanceFromAnchorLine) : "";
  const distBlock = dist
    ? `<div style="margin-top:6px;font-size:11px;color:#57534e;line-height:1.35">${dist}</div>`
    : "";
  return `<div style="max-width:280px;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#292524;padding:2px 4px 2px 0">
  <div style="font-weight:700;letter-spacing:-0.01em">${escapeHtml(pin.name)}</div>
  <div style="margin-top:6px;font-size:11px;color:#444">Rating <strong>${escapeHtml(rating)}</strong></div>
  <div style="margin-top:4px;font-size:11px;color:#444">Decision <strong>${dec}</strong></div>
  ${distBlock}
</div>`;
}

function comparePlacePopupHtml(pin: DecisionMapPin): string {
  const dec = pin.decisionLabel ? escapeHtml(pin.decisionLabel) : "—";
  const fit =
    typeof pin.fitScore === "number" && Number.isFinite(pin.fitScore)
      ? escapeHtml(`Fit ${Math.round(pin.fitScore)}`)
      : "";
  const line2 = fit ? `<span style="font-weight:700">${dec}</span> · ${fit}` : `<span style="font-weight:700">${dec}</span>`;
  const riskRaw = pin.mainRisk?.trim();
  const riskBlock = riskRaw
    ? `<div style="margin-top:6px;font-size:11px;color:#57534e;line-height:1.35">Risk: ${escapeHtml(riskRaw)}</div>`
    : "";
  return `<div style="max-width:280px;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#292524;padding:2px 4px 2px 0">
  <div style="font-weight:700;letter-spacing:-0.01em">${escapeHtml(pin.name)}</div>
  <div style="margin-top:6px;font-size:11px;color:#444;line-height:1.35">${line2}</div>
  ${riskBlock}
</div>`;
}

function popupHtmlForPin(pin: DecisionMapPin, mapMode: MapMode): string {
  if (pin.kind === "anchor") return anchorPopupHtml(pin);
  if (mapMode === "single") return singlePlacePopupHtml(pin);
  if (mapMode === "compare") return comparePlacePopupHtml(pin);
  return recommendationCandidatePopupHtml(pin);
}

type MapsModule = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => {
    fitBounds: (bounds: unknown, padding?: number | Record<string, unknown>) => void;
    setCenter: (c: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
  };
  LatLngBounds: new () => { extend: (p: { lat: number; lng: number }) => void };
  InfoWindow: new (opts?: Record<string, unknown>) => {
    setContent: (html: string) => void;
    open: (opts: { map: unknown; anchor?: unknown }) => void;
    close: () => void;
  };
  importLibrary?: (name: string) => Promise<Record<string, unknown>>;
};

type AdvancedMarkerLike = {
  addListener: (evt: string, fn: () => void) => { remove: () => void };
  map: unknown;
};

type AdvancedMarkerCtor = new (opts: {
  map: unknown;
  position: { lat: number; lng: number };
  content: HTMLElement;
  gmpClickable?: boolean;
}) => AdvancedMarkerLike;

type MarkerHandle = {
  id: string;
  marker: AdvancedMarkerLike;
  pill: HTMLElement;
};

type MapInstance = {
  fitBounds: (bounds: unknown, padding?: number | Record<string, unknown>) => void;
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
};

type InfoWindowInstance = {
  setContent: (html: string) => void;
  open: (opts: { map: unknown; anchor?: unknown }) => void;
  close: () => void;
};

type MapRuntime = {
  map: MapInstance;
  infoWindow: InfoWindowInstance;
  markers: Map<string, MarkerHandle>;
};

function syncMarkerPills(rt: MapRuntime | null, pinList: DecisionMapPin[], mode: MapMode): void {
  if (!rt) return;
  for (const pin of pinList) {
    const h = rt.markers.get(pin.id);
    if (h) styleMarkerPill(h.pill, pin, mode);
  }
}

export function DecisionMapModal({
  open,
  onClose,
  apiKey,
  mapId,
  pins,
  title,
  subtitle,
  mapMode,
  onSelectVenueId,
  footerPrimaryLine,
}: DecisionMapModalProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const pinsRef = useRef(pins);
  useLayoutEffect(() => {
    pinsRef.current = pins;
    if (!open) return;
    syncMarkerPills(runtimeRef.current, pins, mapMode);
  }, [pins, open, mapMode]);

  const onSelectVenueRef = useRef(onSelectVenueId);
  useLayoutEffect(() => {
    onSelectVenueRef.current = onSelectVenueId;
  }, [onSelectVenueId]);

  const mapModeRef = useRef(mapMode);
  useLayoutEffect(() => {
    mapModeRef.current = mapMode;
  }, [mapMode]);

  const runtimeRef = useRef<MapRuntime | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const geometryKey = useMemo(
    () => JSON.stringify(pins.map((p) => ({ id: p.id, k: p.kind, lat: p.lat, lng: p.lng }))),
    [pins],
  );

  /* Google Maps runtime is imperative; ref assignments are intentional. */
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    if (!open) {
      runtimeRef.current = null;
      return;
    }

    const host = mapElRef.current;
    if (!host) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoadError(null);
      try {
        await loadGoogleMapsScript(apiKey);
        if (cancelled || !mapElRef.current) return;

        const maps = window.google?.maps as unknown as MapsModule | undefined;
        if (!maps?.Map) {
          throw new Error("Google Maps unavailable");
        }

        let AdvancedMarkerElement: AdvancedMarkerCtor | null = null;
        if (typeof maps.importLibrary === "function") {
          const markerLib = (await maps.importLibrary("marker")) as Record<string, unknown>;
          const ctor = markerLib.AdvancedMarkerElement;
          if (typeof ctor === "function") AdvancedMarkerElement = ctor as AdvancedMarkerCtor;
        }

        if (!AdvancedMarkerElement) {
          throw new Error("Advanced markers unavailable");
        }

        runtimeRef.current = null;
        host.innerHTML = "";

        const pinsSnapshot = pinsRef.current;
        const map = new maps.Map(host, {
          mapId,
          center: pinsSnapshot[0] ? { lat: pinsSnapshot[0].lat, lng: pinsSnapshot[0].lng } : { lat: 0, lng: 0 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        const infoWindow = new maps.InfoWindow();
        const markers = new Map<string, MarkerHandle>();

        for (const pin of pinsSnapshot) {
          const { root, pill } = createPinShell();
          styleMarkerPill(pill, pin, mapModeRef.current);

          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: pin.lat, lng: pin.lng },
            content: root,
            gmpClickable: true,
          });

          const pinId = pin.id;
          const listener = marker.addListener("click", () => {
            const pinLive = pinsRef.current.find((p) => p.id === pinId);
            if (!pinLive) return;
            infoWindow.setContent(popupHtmlForPin(pinLive, mapModeRef.current));
            infoWindow.open({ map, anchor: marker });
            if (mapModeRef.current === "recommendation" && !isAnchorPinId(pinId)) {
              onSelectVenueRef.current?.(pinId);
            }
          });

          cleanups.push(() => {
            listener.remove();
            marker.map = null;
          });
          markers.set(pin.id, { id: pin.id, marker, pill });
        }

        runtimeRef.current = { map, infoWindow, markers };
        syncMarkerPills(runtimeRef.current, pinsRef.current, mapModeRef.current);

        const pts = pinsSnapshot.map((p) => ({ lat: p.lat, lng: p.lng }));
        if (pts.length === 1) {
          map.setCenter(pts[0]);
          map.setZoom(15);
        } else if (pts.length > 1) {
          const bounds = new maps.LatLngBounds();
          pts.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, 56);
        }

        cleanups.push(() => infoWindow.close());
      } catch {
        if (!cancelled) setLoadError("Map could not load. The ranked list is still available.");
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
      runtimeRef.current = null;
      host.innerHTML = "";
    };
  }, [open, apiKey, mapId, mapMode, geometryKey]);
  /* eslint-enable react-hooks/immutability */

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close map"
        onClick={onClose}
      />

      <div className="relative z-[1] flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200/60">
        <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-semibold tracking-tight text-stone-950 sm:text-lg">{title}</h2>
            <p className="text-[11px] leading-snug text-stone-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Close
          </button>
        </header>

        <div className="relative h-[min(52vh,420px)] min-h-[260px] w-full bg-stone-100">
          {loadError ? (
            <div className="absolute inset-0 z-[1] flex items-center justify-center bg-stone-100 px-6 text-center">
              <p className="max-w-md text-sm leading-relaxed text-stone-700">{loadError}</p>
            </div>
          ) : null}
          <div ref={mapElRef} className="h-full w-full" />
        </div>

        <footer className="space-y-2 border-t border-stone-100 px-4 py-3 sm:px-5 sm:py-3.5">
          {footerPrimaryLine ? (
            <p className="whitespace-pre-line text-[12px] font-medium leading-snug text-stone-800">{footerPrimaryLine}</p>
          ) : null}
          <p className="text-[10px] leading-snug text-stone-400">Distances are approximate.</p>
        </footer>
      </div>
    </div>
  );
}
