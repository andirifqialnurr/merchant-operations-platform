"use client";

import { useEffect, useState } from "react";

/**
 * Whether the page fills the screen (the kitchen screen's kiosk mode), and a
 * way to switch that. Every caller sees the same state: it is the browser's.
 */
export function useFullscreen() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    // A browser may refuse (e.g. inside a frame); the screen then stays as it is.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { active, toggle };
}
