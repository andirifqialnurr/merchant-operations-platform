import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Package,
  Palette,
  Ruler,
  Settings,
  Type,
} from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";

import { ThemeSwitcher } from "@/components/theme/theme-switcher";

const foundationBanks = [
  {
    description: "Primitive palette, semantic color, status, dan merchant storefront preset.",
    href: "/color-bank",
    icon: Palette,
    label: "Buka Color Bank",
    meta: "Light · Dark · 6 brand presets",
    title: "Color Bank",
  },
  {
    description: "Geist Sans, 12 text styles, numeric typography, dan overflow utilities.",
    href: "/typography",
    icon: Type,
    label: "Buka Typography Bank",
    meta: "12 styles · 4 weights · Tabular numbers",
    title: "Typography Bank",
  },
  {
    description: "Spacing, control height, radius, shadow, motion, dan wrapper ikon Lucide.",
    href: "/foundation",
    icon: Ruler,
    label: "Buka Layout dan Icon Foundation",
    meta: "4px grid · 5 icon sizes · Reduced motion",
    title: "Layout & Icon Foundation",
  },
] as const;

const statusTokens = [
  { className: "bg-info-surface text-info", label: "Info" },
  { className: "bg-success-surface text-success", label: "Success" },
  { className: "bg-warning-surface text-warning", label: "Warning" },
  { className: "bg-danger-surface text-danger", label: "Danger" },
  { className: "bg-special-surface text-special", label: "Special" },
] as const;

const controlSizes = [
  { className: "h-control-xs", label: "xs", value: "28" },
  { className: "h-control-sm", label: "sm", value: "32" },
  { className: "h-control-md", label: "md", value: "40" },
  { className: "h-control-lg", label: "lg", value: "48" },
  { className: "h-control-xl", label: "xl", value: "56" },
] as const;

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-line-default pb-6">
          <Link className="text-label text-primary underline" href="/">
            Kembali ke workspace
          </Link>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-caption-xs uppercase text-primary">Calm Commerce · Version 1</p>
              <h1 className="mt-2 text-display">Merchant Design System</h1>
              <p className="mt-3 max-w-3xl text-body-lg text-foreground-secondary">
                Satu halaman untuk melihat fondasi visual yang sudah dikunci sebelum component bank
                dan halaman produk mulai dibangun.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-line-default bg-surface px-3 py-2 text-label">
                WCAG 2.2 AA
              </span>
              <span className="rounded-full border border-line-default bg-surface px-3 py-2 text-label">
                Geist
              </span>
              <span className="rounded-full border border-line-default bg-surface px-3 py-2 text-label">
                Lucide
              </span>
            </div>
          </div>
          <div className="mt-6">
            <ThemeSwitcher />
          </div>
        </header>

        <div className="mt-8 grid gap-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Theme mode", "3", "Light, dark, system"],
              ["Text style", "12", "Caption sampai display"],
              ["Spacing token", "14", "Grid dasar 4px"],
              ["Icon size", "5", "14 sampai 32px"],
            ].map(([label, value, helper]) => (
              <article className="rounded-lg border border-line-default bg-surface p-4" key={label}>
                <p className="text-caption text-foreground-muted">{label}</p>
                <p className="numeric-tabular mt-2 text-display-sm">{value}</p>
                <p className="mt-1 text-body-sm text-foreground-secondary">{helper}</p>
              </article>
            ))}
          </section>

          <section>
            <p className="text-caption-xs uppercase text-primary">Foundation directory</p>
            <h2 className="mt-1 text-title">Bank yang sudah tersedia</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {foundationBanks.map((bank) => (
                <article
                  className="flex flex-col rounded-xl border border-line-default bg-surface p-5"
                  key={bank.href}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-lg border border-line-default bg-primary-subtle p-3 text-primary">
                      <AppIcon icon={bank.icon} label={bank.title} size="lg" />
                    </span>
                    <span className="text-caption text-foreground-muted">Ready</span>
                  </div>
                  <h3 className="mt-5 text-heading-lg">{bank.title}</h3>
                  <p className="mt-2 flex-1 text-body text-foreground-secondary">
                    {bank.description}
                  </p>
                  <p className="mt-4 text-caption text-foreground-muted">{bank.meta}</p>
                  <Link
                    className="mt-5 inline-flex items-center gap-2 text-label text-primary underline"
                    href={bank.href}
                  >
                    {bank.label}
                    <AppIcon icon={ArrowRight} />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section>
            <p className="text-caption-xs uppercase text-primary">Theme comparison</p>
            <h2 className="mt-1 text-title">Semantic surface berdampingan</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(["light", "dark"] as const).map((mode) => (
                <article
                  className="rounded-xl border border-line-default bg-canvas p-5 text-foreground"
                  data-theme-preview={mode}
                  key={mode}
                >
                  <p className="text-caption-xs uppercase text-primary">Mode {mode}</p>
                  <div className="mt-4 rounded-lg border border-line-default bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <span className="rounded-md bg-primary-subtle p-2 text-primary">
                        <AppIcon icon={LayoutGrid} label="Dashboard" />
                      </span>
                      <div>
                        <h3 className="text-heading-sm">Ringkasan outlet</h3>
                        <p className="mt-1 text-body-sm text-foreground-secondary">
                          Surface, border, text, dan action memakai semantic token yang sama.
                        </p>
                      </div>
                    </div>
                    <p className="numeric-money mt-5 text-display-sm">Rp8.750.000</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Semantic status</p>
              <h2 className="mt-1 text-title">Color reference</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                {statusTokens.map((status) => (
                  <span
                    className={`rounded-full px-3 py-2 text-label ${status.className}`}
                    key={status.label}
                  >
                    {status.label}
                  </span>
                ))}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-line-default bg-surface-subtle p-4">
                  <p className="text-caption text-foreground-muted">Body</p>
                  <p className="mt-1 text-body">Default operasional 14/20</p>
                </div>
                <div className="rounded-lg border border-line-default bg-surface-subtle p-4">
                  <p className="text-caption text-foreground-muted">Title</p>
                  <p className="mt-1 text-title">Judul halaman 24/32</p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Sizing reference</p>
              <h2 className="mt-1 text-title">Control dan icon</h2>
              <div className="mt-5 grid gap-3">
                {controlSizes.map((size) => (
                  <div className="foundation-spacing-row grid items-center" key={size.label}>
                    <span className="font-technical text-caption text-primary">{size.label}</span>
                    <div
                      className={`${size.className} flex items-center rounded-md border border-line-control bg-surface-subtle px-3 text-label`}
                    >
                      Control preview
                    </div>
                    <span className="numeric-tabular text-right text-caption text-foreground-muted">
                      {size.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-5">
                <AppIcon icon={CheckCircle2} label="Selesai" size="xs" />
                <AppIcon icon={Clock3} label="Menunggu" size="sm" />
                <AppIcon icon={Package} label="Produk" size="md" />
                <AppIcon icon={Settings} label="Pengaturan" size="lg" />
                <AppIcon icon={Palette} label="Tema" size="xl" />
              </div>
            </article>
          </section>

          <aside className="rounded-xl border border-line-default bg-primary-subtle p-5">
            <p className="text-heading-sm">Checkpoint berikutnya: Component Bank</p>
            <p className="mt-2 text-body text-foreground-secondary">
              Storybook, component testing, dan accessibility harness baru dimulai setelah halaman
              overview ini direview dan dipush sebagai checkpoint terpisah.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
