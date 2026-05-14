"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

function getSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

/** True when viewport is at least Tailwind `lg` (1024px). */
export function useMinWidthLg(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
