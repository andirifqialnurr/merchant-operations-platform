"use client";

import { Suspense } from "react";

import { PosTablesPage } from "@/features/pos";

export default function PosTablesRoute() {
  // The page reads which table to open from the address.
  return (
    <Suspense>
      <PosTablesPage />
    </Suspense>
  );
}
