"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches right now, for the few layouts that are
 * a different structure on a wide screen and not only a different size.
 * Counts as not matching on the server and before the first paint.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}
