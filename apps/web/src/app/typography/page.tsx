import Link from "next/link";

import { ThemeSwitcher } from "@/components/theme/theme-switcher";

type TextStylePreview = {
  token: string;
  className: string;
  specification: string;
  purpose: string;
  sample: string;
};

const textStyles: TextStylePreview[] = [
  {
    token: "caption-xs",
    className: "text-caption-xs",
    specification: "11/16 · 500",
    purpose: "Metadata nonkritis",
    sample: "Sinkron terakhir 10:42 WIB",
  },
  {
    token: "caption",
    className: "text-caption",
    specification: "12/16 · 400",
    purpose: "Helper dan timestamp",
    sample: "Harga sudah termasuk pajak outlet",
  },
  {
    token: "body-sm",
    className: "text-body-sm",
    specification: "13/18 · 400",
    purpose: "Tabel padat opsional",
    sample: "Stok tersedia di Gudang Utama",
  },
  {
    token: "body",
    className: "text-body",
    specification: "14/20 · 400",
    purpose: "Default backoffice",
    sample: "Pesanan diteruskan ke area dapur utama.",
  },
  {
    token: "body-lg",
    className: "text-body-lg",
    specification: "16/24 · 400",
    purpose: "Customer dan touch form",
    sample: "Pilih metode pembayaran untuk melanjutkan.",
  },
  {
    token: "label",
    className: "text-label",
    specification: "14/20 · 500",
    purpose: "Form label dan button",
    sample: "Nama kategori produk",
  },
  {
    token: "heading-sm",
    className: "text-heading-sm",
    specification: "16/24 · 600",
    purpose: "Card atau section kecil",
    sample: "Ringkasan pembayaran",
  },
  {
    token: "heading",
    className: "text-heading",
    specification: "18/26 · 600",
    purpose: "Section utama",
    sample: "Pesanan yang sedang diproses",
  },
  {
    token: "heading-lg",
    className: "text-heading-lg",
    specification: "20/28 · 600",
    purpose: "Halaman compact",
    sample: "Laporan penjualan harian",
  },
  {
    token: "title",
    className: "text-title",
    specification: "24/32 · 600",
    purpose: "Judul halaman",
    sample: "Operasional Outlet Sudirman",
  },
  {
    token: "display-sm",
    className: "text-display-sm",
    specification: "28/36 · 650",
    purpose: "Total POS dan timer KDS",
    sample: "Rp12.450.000",
  },
  {
    token: "display",
    className: "text-display",
    specification: "32/40 · 700",
    purpose: "Angka sangat penting",
    sample: "128 pesanan",
  },
];

const weights = [
  { name: "Regular", className: "font-regular", value: "400" },
  { name: "Medium", className: "font-medium", value: "500" },
  { name: "Semibold", className: "font-semibold", value: "600" },
  { name: "Bold", className: "font-bold", value: "700" },
];

function TextStyleBank() {
  return (
    <section className="rounded-2xl border border-line-default bg-surface">
      <div className="border-b border-line-default p-5">
        <p className="text-caption-xs uppercase text-primary">12 semantic styles</p>
        <h2 className="mt-1 text-title">Text-style bank</h2>
        <p className="mt-2 text-body text-foreground-secondary">
          Seluruh ukuran, line-height, weight, dan tracking berasal dari token typography.
        </p>
      </div>

      <div className="divide-y divide-line-subtle">
        {textStyles.map((style) => (
          <article className="grid gap-3 p-5 lg:grid-cols-4 lg:items-center" key={style.token}>
            <div>
              <p className="font-technical text-caption-xs text-primary">{style.token}</p>
              <p className="mt-1 text-caption text-foreground-muted">{style.specification}</p>
            </div>
            <p className="text-caption text-foreground-secondary">{style.purpose}</p>
            <p className={style.className}>{style.sample}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function NumericPreview() {
  return (
    <section className="rounded-2xl border border-line-default bg-surface p-5">
      <p className="text-caption-xs uppercase text-primary">Geist Sans · tabular numbers</p>
      <h2 className="mt-1 text-title">Numeric typography</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-line-default bg-surface-subtle p-4">
          <p className="text-caption text-foreground-muted">Nominal transaksi</p>
          <p className="numeric-money mt-2 text-heading-lg">Rp8.750.000</p>
        </article>
        <article className="rounded-xl border border-line-default bg-surface-subtle p-4">
          <p className="text-caption text-foreground-muted">Nomor pesanan</p>
          <p className="numeric-tabular mt-2 text-heading-lg">ORD-02481</p>
        </article>
        <article className="rounded-xl border border-line-default bg-surface-subtle p-4">
          <p className="text-caption text-foreground-muted">Quantity dan stok</p>
          <p className="numeric-quantity mt-2 text-heading-lg">001.248 unit</p>
        </article>
        <article className="rounded-xl border border-line-default bg-surface-subtle p-4">
          <p className="text-caption text-foreground-muted">Timer KDS</p>
          <p className="numeric-timer mt-2 text-display-sm">08:42</p>
        </article>
      </div>
    </section>
  );
}

function ThemeComparison() {
  return (
    <section>
      <p className="text-caption-xs uppercase text-primary">Semantic color + typography</p>
      <h2 className="mt-1 text-title">Light dan dark berdampingan</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(["light", "dark"] as const).map((mode) => (
          <article
            className="rounded-2xl border border-line-default bg-canvas p-5 text-foreground"
            data-theme-preview={mode}
            key={mode}
          >
            <p className="text-caption-xs uppercase text-foreground-muted">Mode {mode}</p>
            <h3 className="mt-2 text-heading-lg">Ringkasan shift kasir</h3>
            <p className="mt-2 text-body text-foreground-secondary">
              Tipografi menggunakan kontrak yang sama dan hanya semantic color yang berubah.
            </p>
            <p className="numeric-money mt-5 text-display-sm">Rp4.825.000</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function TypographyPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-line-default pb-6">
          <Link className="text-label text-primary underline" href="/">
            Kembali ke workspace
          </Link>
          <p className="mt-6 text-caption-xs uppercase text-primary">Development preview</p>
          <h1 className="mt-2 text-display">Geist Typography Bank</h1>
          <p className="mt-3 max-w-3xl text-body-lg text-foreground-secondary">
            Source of truth untuk type scale, weight, tracking, angka operasional, truncation, dan
            penggunaan terbatas Geist Mono.
          </p>
          <div className="mt-6">
            <ThemeSwitcher />
          </div>
        </header>

        <div className="mt-8 grid gap-6">
          <TextStyleBank />
          <NumericPreview />
          <ThemeComparison />

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Weight contract</p>
              <h2 className="mt-1 text-title">400 sampai 700</h2>
              <div className="mt-4 grid gap-3">
                {weights.map((weight) => (
                  <div className="flex items-baseline justify-between gap-4" key={weight.value}>
                    <p className={"text-body-lg " + weight.className}>{weight.name}</p>
                    <p className="font-technical text-caption text-foreground-muted">
                      {weight.value}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Tracking contract</p>
              <h2 className="mt-1 text-title">Display sampai caption</h2>
              <div className="mt-4 grid gap-3">
                <p className="text-heading-lg tracking-display">Display / title · -0.02em</p>
                <p className="text-heading tracking-heading">Heading · -0.01em</p>
                <p className="text-body tracking-body">Body dan label · 0</p>
                <p className="text-caption tracking-caption">Caption · 0.01em</p>
              </div>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Long label & mixed-case</p>
              <h2 className="mt-1 text-title">Konten Bahasa Indonesia</h2>
              <p className="mt-4 text-label">
                Konfirmasi perubahan jadwal operasional khusus hari libur nasional
              </p>
              <p className="mt-3 text-body text-foreground-secondary">
                Produk SKU-ARABICA-250g tetap memakai mixed-case; judul dan tombol tidak dipaksa
                menjadi uppercase.
              </p>
            </article>

            <article className="rounded-2xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Technical utility</p>
              <h2 className="mt-1 text-title">Geist Mono terbatas</h2>
              <dl className="mt-4 grid gap-3">
                <div>
                  <dt className="text-caption text-foreground-muted">Request ID</dt>
                  <dd className="font-technical mt-1 text-body-sm">req_01JZ8C7Q2B9M4K6Y</dd>
                </div>
                <div>
                  <dt className="text-caption text-foreground-muted">Device identifier</dt>
                  <dd className="font-technical mt-1 text-body-sm">POS-SUDIRMAN-03</dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="rounded-2xl border border-line-default bg-surface p-5">
            <p className="text-caption-xs uppercase text-primary">Overflow utilities</p>
            <h2 className="mt-1 text-title">Truncate dan line clamp</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <article className="min-w-0 rounded-xl border border-line-default p-4">
                <p className="text-caption text-foreground-muted">Satu baris</p>
                <p className="text-truncate-one mt-2 text-body">
                  Paket bundling sarapan keluarga dengan tambahan minuman dan pilihan topping
                </p>
              </article>
              <article className="rounded-xl border border-line-default p-4">
                <p className="text-caption text-foreground-muted">Maksimal dua baris</p>
                <p className="text-clamp-two mt-2 text-body">
                  Catatan pelanggan: pisahkan sambal, kurangi es, dan pastikan semua alat makan
                  tersedia untuk pesanan dibawa pulang.
                </p>
              </article>
              <article className="rounded-xl border border-line-default p-4">
                <p className="text-caption text-foreground-muted">Maksimal tiga baris</p>
                <p className="text-clamp-three mt-2 text-body">
                  Deskripsi produk yang panjang tetap dapat dibaca secara ringkas tanpa mengubah
                  ritme layout pada kartu operasional dan halaman customer.
                </p>
              </article>
            </div>
          </section>

          <aside className="rounded-2xl border border-line-default bg-primary-subtle p-5">
            <p className="text-heading-sm">Checklist visual 200%</p>
            <p className="mt-2 text-body text-foreground-secondary">
              Seluruh ukuran memakai rem dan layout responsif. Verifikasi browser pada zoom 200%
              tetap diperlukan sebelum acceptance gate ditutup.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
