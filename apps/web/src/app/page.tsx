import Link from "next/link";

import { DeviceModeSelector } from "@/components/device-mode-selector";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-8">
        <header className="border-b border-line-default pb-6">
          <p className="text-caption-xs uppercase text-primary">Merchant Operations Platform</p>
          <h1 className="mt-2 text-display-sm">Merchant PWA</h1>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link className="text-label text-primary underline" href="/backoffice/catalog">
              Buka Backoffice Catalog
            </Link>
            <Link className="text-label text-primary underline" href="/design-system">
              Buka Merchant Design System
            </Link>
          </div>
        </header>
        <DeviceModeSelector />
      </div>
    </main>
  );
}
