/**
 * Loads Google Maps JavaScript API once (client-only).
 * Uses `libraries=marker` for AdvancedMarkerElement.
 */

let loadPromise: Promise<void> | null = null;

export function resetGoogleMapsLoaderForTests(): void {
  loadPromise = null;
}

function isGoogleMapsReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.google?.maps);
}

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (isGoogleMapsReady()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const settleOk = () => {
      if (isGoogleMapsReady()) resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[data-vibegap-gmaps="1"]`);
    if (existing) {
      existing.addEventListener("load", settleOk, { once: true });
      existing.addEventListener(
        "error",
        () => {
          loadPromise = null;
          reject(new Error("Google Maps script failed"));
        },
        { once: true },
      );
      // If the script already finished loading before we attached listeners.
      settleOk();
      return;
    }

    const cbName = `__vibegapGmapsCb_${Date.now()}`;
    (window as unknown as Record<string, () => void>)[cbName] = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      resolve();
    };

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.vibegapGmaps = "1";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&callback=${cbName}&v=weekly`;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Google Maps script failed"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
