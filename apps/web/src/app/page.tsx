import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas p-8 text-foreground">
      <h1 className="text-title">Merchant Operations Platform</h1>
      <p className="mt-2 text-body">Fondasi workspace siap. Fitur produk belum dibuat.</p>
      <Link className="mt-4 inline-block text-label text-primary underline" href="/color-bank">
        Buka development Color Bank
      </Link>
      <br />
      <Link className="mt-2 inline-block text-label text-primary underline" href="/typography">
        Buka development Typography Bank
      </Link>
      <br />
      <Link className="mt-2 inline-block text-label text-primary underline" href="/foundation">
        Buka development Layout dan Icon Foundation
      </Link>
    </main>
  );
}
