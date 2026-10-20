"use client";

import { useEffect, useState } from "react";
import type { ReceiptPaper } from "@merchant/ui/receipt";

const PAPER_KEY = "pos-receipt-paper";
export const RECEIPT_PAPERS: readonly ReceiptPaper[] = ["58mm", "80mm", "a4"];

/** Per-device print preference, shared by order and visit receipts; never a money input. */
export function useReceiptPaper() {
  const [paper, setPaper] = useState<ReceiptPaper>("80mm");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PAPER_KEY);
      if (stored && (RECEIPT_PAPERS as readonly string[]).includes(stored)) {
        const timer = window.setTimeout(() => setPaper(stored as ReceiptPaper), 0);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Storage may be unavailable; printing still works with the default.
    }
    return undefined;
  }, []);
  return [
    paper,
    (next: ReceiptPaper) => {
      setPaper(next);
      try {
        window.localStorage.setItem(PAPER_KEY, next);
      } catch {
        /* Keep the current selection. */
      }
    },
  ] as const;
}
