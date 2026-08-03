import Link from "next/link";

export default function KdsPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <section className="mx-auto grid max-w-5xl gap-6">
        <header className="border-b border-line-default pb-6">
          <p className="text-caption-xs uppercase text-primary">Kitchen display</p>
          <h1 className="mt-2 text-display-sm">KDS</h1>
          <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
            Surface dapur untuk membaca ticket dan status sinkronisasi dari read model KDS.
          </p>
        </header>

        <section className="grid gap-3 rounded-lg border border-line-default bg-surface-subtle p-5">
          <h2 className="text-heading-sm">Server acknowledgement</h2>
          <p className="text-body-sm text-foreground-secondary">
            Perubahan status ticket membutuhkan konfirmasi server sebelum berpindah dari tampilan
            lokal.
          </p>
        </section>

        <nav aria-label="Navigasi surface" className="flex flex-wrap gap-3">
          <Link className="ui-button ui-button--md ui-button--secondary" href="/">
            <span className="ui-button__label">Kembali ke Device Mode</span>
          </Link>
          <Link className="ui-button ui-button--md ui-button--primary" href="/backoffice/catalog">
            <span className="ui-button__label">Buka Backoffice Catalog</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
