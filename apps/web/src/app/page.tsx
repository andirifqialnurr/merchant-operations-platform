import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas p-8 text-foreground">
      <h1>Merchant Operations Platform</h1>
      <p>Fondasi workspace siap. Fitur produk belum dibuat.</p>
      <Link className="text-primary underline" href="/color-bank">
        Buka development Color Bank
      </Link>
    </main>
  );
}
