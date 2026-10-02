"use client";

import { Suspense } from "react";

import { CatalogPage } from "@/features/catalog";

export default function CatalogRoute() {
  return (
    <Suspense>
      <CatalogPage />
    </Suspense>
  );
}
