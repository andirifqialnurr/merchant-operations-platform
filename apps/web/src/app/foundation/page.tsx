import type { CSSProperties } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock3, Package, Settings } from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";

import { ThemeSwitcher } from "@/components/theme/theme-switcher";

const spacingTokens = [
  ["0", "0px", "--space-0"],
  ["0.5", "2px", "--space-0-5"],
  ["1", "4px", "--space-1"],
  ["1.5", "6px", "--space-1-5"],
  ["2", "8px", "--space-2"],
  ["3", "12px", "--space-3"],
  ["4", "16px", "--space-4"],
  ["5", "20px", "--space-5"],
  ["6", "24px", "--space-6"],
  ["8", "32px", "--space-8"],
  ["10", "40px", "--space-10"],
  ["12", "48px", "--space-12"],
  ["16", "64px", "--space-16"],
  ["20", "80px", "--space-20"],
] as const;

const controlHeights = [
  ["xs", "28px", "--control-height-xs", "Dense table action"],
  ["sm", "32px", "--control-height-sm", "Toolbar compact"],
  ["md", "40px", "--control-height-md", "Default backoffice"],
  ["lg", "48px", "--control-height-lg", "POS dan touch form"],
  ["xl", "56px", "--control-height-xl", "CTA mobile atau kiosk"],
] as const;

const radiusTokens = [
  ["none", "0px", "--foundation-radius-none"],
  ["xs", "4px", "--foundation-radius-xs"],
  ["sm", "6px", "--foundation-radius-sm"],
  ["md", "8px", "--foundation-radius-md"],
  ["lg", "12px", "--foundation-radius-lg"],
  ["xl", "16px", "--foundation-radius-xl"],
  ["full", "9999px", "--foundation-radius-full"],
] as const;

const shadowTokens = ["none", "xs", "sm", "md", "lg"] as const;

const motionTokens = [
  ["instant", "75ms", "Press feedback"],
  ["fast", "120ms", "Hover dan focus"],
  ["normal", "180ms", "Popover dan menu"],
  ["slow", "240ms", "Dialog dan drawer"],
] as const;

function tokenStyle(property: string, token: string): CSSProperties {
  return { [property]: `var(${token})` };
}

export default function FoundationPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-line-default pb-6">
          <Link className="text-label text-primary underline" href="/">
            Kembali ke workspace
          </Link>
          <p className="mt-6 text-caption-xs uppercase text-primary">Development preview</p>
          <h1 className="mt-2 text-display">Layout dan Icon Foundation</h1>
          <p className="mt-3 max-w-3xl text-body-lg text-foreground-secondary">
            Source of truth untuk spacing, control height, radius, shadow, motion, dan ukuran ikon
            sebelum component bank dibangun.
          </p>
          <div className="mt-6">
            <ThemeSwitcher />
          </div>
        </header>

        <div className="mt-8 grid gap-6">
          <section className="rounded-xl border border-line-default bg-surface p-5">
            <p className="text-caption-xs uppercase text-primary">4px base grid</p>
            <h2 className="mt-1 text-title">Spacing scale</h2>
            <div className="mt-5 grid gap-3">
              {spacingTokens.map(([name, value, token]) => (
                <div className="foundation-spacing-row grid items-center" key={name}>
                  <code className="font-technical text-caption text-primary">{name}</code>
                  <div className="h-3 rounded-full bg-surface-subtle">
                    <div
                      className="h-3 rounded-full bg-primary"
                      style={tokenStyle("width", token)}
                    />
                  </div>
                  <span className="numeric-tabular text-right text-caption text-foreground-muted">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-line-default bg-surface p-5">
            <p className="text-caption-xs uppercase text-primary">Interactive sizing</p>
            <h2 className="mt-1 text-title">Control height</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {controlHeights.map(([name, value, token, purpose]) => (
                <article
                  className="rounded-lg border border-line-default bg-surface-subtle p-4"
                  key={name}
                >
                  <div
                    className="flex items-center justify-center rounded-md border border-line-control bg-surface text-label"
                    style={tokenStyle("height", token)}
                  >
                    {name}
                  </div>
                  <p className="numeric-tabular mt-3 text-caption text-foreground-muted">{value}</p>
                  <p className="mt-1 text-body-sm">{purpose}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Surface shape</p>
              <h2 className="mt-1 text-title">Radius</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {radiusTokens.map(([name, value, token]) => (
                  <div
                    className="flex aspect-square flex-col items-center justify-center border border-line-control bg-surface-subtle"
                    key={name}
                    style={tokenStyle("borderRadius", token)}
                  >
                    <span className="text-label">{name}</span>
                    <span className="numeric-tabular text-caption text-foreground-muted">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Elevation</p>
              <h2 className="mt-1 text-title">Shadow + border</h2>
              <p className="mt-2 text-body text-foreground-secondary">
                Border tetap menjadi pembeda surface utama pada dark mode.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {shadowTokens.map((token) => (
                  <div
                    className="flex h-24 items-center justify-center rounded-lg border border-line-default bg-surface-raised text-label"
                    key={token}
                    style={tokenStyle("boxShadow", `--foundation-shadow-${token}`)}
                  >
                    {token}
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Motion contract</p>
              <h2 className="mt-1 text-title">Duration dan easing</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {motionTokens.map(([name, duration, purpose]) => (
                  <div
                    className="foundation-motion-demo rounded-lg border border-line-default bg-surface-subtle p-4 hover:border-primary hover:bg-primary-subtle"
                    key={name}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-label">{name}</span>
                      <span className="numeric-tabular text-caption text-foreground-muted">
                        {duration}
                      </span>
                    </div>
                    <p className="mt-2 text-body-sm text-foreground-secondary">{purpose}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-body-sm text-foreground-muted">
                prefers-reduced-motion mengubah seluruh duration menjadi 0ms dan menghapus
                transform.
              </p>
            </article>

            <article className="rounded-xl border border-line-default bg-surface p-5">
              <p className="text-caption-xs uppercase text-primary">Lucide wrapper</p>
              <h2 className="mt-1 text-title">AppIcon</h2>
              <div className="mt-5 flex flex-wrap items-end gap-6">
                <div className="grid justify-items-center gap-2">
                  <AppIcon icon={Bell} label="Notifikasi" size="xs" />
                  <span className="text-caption">xs · 14</span>
                </div>
                <div className="grid justify-items-center gap-2">
                  <AppIcon icon={CheckCircle2} label="Berhasil" size="sm" />
                  <span className="text-caption">sm · 16</span>
                </div>
                <div className="grid justify-items-center gap-2 text-primary">
                  <AppIcon icon={Package} label="Produk" size="md" />
                  <span className="text-caption">md · 20</span>
                </div>
                <div className="grid justify-items-center gap-2 text-warning">
                  <AppIcon icon={Clock3} label="Menunggu" size="lg" />
                  <span className="text-caption">lg · 24</span>
                </div>
                <div className="grid justify-items-center gap-2">
                  <AppIcon icon={Settings} label="Pengaturan" size="xl" />
                  <span className="text-caption">xl · 32</span>
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-line-default bg-surface-subtle p-4">
                <p className="text-label">Accessible rule</p>
                <p className="mt-2 text-body-sm text-foreground-secondary">
                  Ikon bermakna menerima label; ikon dekoratif otomatis disembunyikan dari
                  accessibility tree. Warna selalu mengikuti currentColor.
                </p>
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
