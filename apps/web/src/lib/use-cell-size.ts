"use client";

import { useEffect, useState } from "react";

/**
 * The size of one grid cell that fits a floor of `columns` cells into the box
 * the returned ref is put on, within `min` and `max` pixels. The box can
 * appear after loading, so it is measured whenever it is attached.
 */
export function useCellSize(columns: number, min: number, max: number) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [cell, setCell] = useState(min);
  useEffect(() => {
    if (!box) return;
    const measure = () =>
      setCell(Math.max(min, Math.min(max, Math.floor(box.clientWidth / columns))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box, columns, max, min]);
  return { cell, ref: setBox };
}
