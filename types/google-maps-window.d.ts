export {};

declare global {
  interface Window {
    /** Present after Google Maps JavaScript API loads (client-only). */
    google?: {
      maps?: unknown;
    };
  }
}
