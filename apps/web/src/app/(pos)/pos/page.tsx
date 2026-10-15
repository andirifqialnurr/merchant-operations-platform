"use client";

import { Suspense } from "react";

import { SellPage } from "@/features/pos";

export default function SellRoute() {
  // The sell screen reads from the address whether the order is for a table.
  return (
    <Suspense>
      <SellPage />
    </Suspense>
  );
}
