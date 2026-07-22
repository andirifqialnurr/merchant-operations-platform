import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas p-8 text-foreground">
      <h1 className="text-title">Merchant Operations Platform</h1>
      <p className="mt-2 text-body">Fondasi workspace dan backoffice Catalog sudah tersedia.</p>
      <Link
        className="mt-4 inline-block text-label text-primary underline"
        href="/backoffice/catalog"
      >
        Buka Backoffice Catalog
      </Link>
      <Link
        className="ml-4 mt-4 inline-block text-label text-primary underline"
        href="/design-system"
      >
        Buka Merchant Design System
      </Link>
    </main>
  );
}
