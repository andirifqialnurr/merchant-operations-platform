import type { CSSProperties } from "react";

import Link from "next/link";

import { ThemeSwitcher } from "@/components/theme/theme-switcher";

type PrimitiveGroup = {
  name: string;
  tokens: string[];
};

const primitiveGroups: PrimitiveGroup[] = [
  {
    name: "Neutral",
    tokens: [
      "neutral-0",
      "neutral-25",
      "neutral-50",
      "neutral-100",
      "neutral-200",
      "neutral-300",
      "neutral-400",
      "neutral-500",
      "neutral-600",
      "neutral-700",
      "neutral-750",
      "neutral-800",
      "neutral-850",
      "neutral-900",
      "neutral-925",
      "neutral-950",
    ],
  },
  {
    name: "Status",
    tokens: [
      "green-50",
      "green-300",
      "green-700",
      "green-950",
      "amber-50",
      "amber-300",
      "amber-700",
      "amber-950",
      "red-50",
      "red-300",
      "red-700",
      "red-950",
      "blue-50",
      "blue-300",
      "blue-700",
      "blue-950",
    ],
  },
  {
    name: "Chart",
    tokens: [
      "chart-light-1",
      "chart-light-2",
      "chart-light-3",
      "chart-light-4",
      "chart-light-5",
      "chart-dark-1",
      "chart-dark-2",
      "chart-dark-3",
      "chart-dark-4",
      "chart-dark-5",
    ],
  },
  {
    name: "Storefront brand",
    tokens: [
      "brand-blue-400",
      "brand-blue-700",
      "brand-teal-400",
      "brand-teal-700",
      "brand-green-400",
      "brand-green-700",
      "brand-rose-400",
      "brand-rose-700",
      "brand-orange-400",
      "brand-orange-700",
    ],
  },
];

const merchantPresets = ["ink", "blue", "teal", "green", "rose", "orange"] as const;

const statusSamples = [
  { name: "Informasi", className: "bg-info-surface text-info" },
  { name: "Berhasil", className: "bg-success-surface text-success" },
  { name: "Peringatan", className: "bg-warning-surface text-warning" },
  { name: "Bahaya", className: "bg-danger-surface text-danger" },
];

const chartSeries = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
];

const textSamples = [
  { name: "Teks utama", className: "text-foreground" },
  { name: "Teks sekunder", className: "text-foreground-secondary" },
  { name: "Teks redup", className: "text-foreground-muted" },
  { name: "Teks nonaktif", className: "text-foreground-disabled" },
];

function PrimitivePalette({ group }: Readonly<{ group: PrimitiveGroup }>) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{group.name}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {group.tokens.map((token) => (
          <div className="overflow-hidden rounded-md border border-line-default" key={token}>
            <div
              aria-hidden="true"
              className="h-14"
              style={{ backgroundColor: `var(--primitive-color-${token})` } as CSSProperties}
            />
            <div className="border-t border-line-subtle bg-surface px-2 py-1.5 text-xs">
              {token}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SemanticThemePreview({ mode }: Readonly<{ mode: "light" | "dark" }>) {
  return (
    <article
      className="grid gap-4 rounded-lg border border-line-default bg-canvas p-4 text-foreground"
      data-theme-preview={mode}
    >
      <h3 className="text-sm font-semibold">{mode === "dark" ? "Dark" : "Light"}</h3>

      <section className="rounded-lg border border-line-default bg-surface p-4">
        <div className="grid gap-1 text-sm">
          {textSamples.map((sample) => (
            <p className={sample.className} key={sample.name}>
              {sample.name}
            </p>
          ))}
        </div>
        <div className="mt-3 rounded-md border border-line-subtle bg-surface-subtle p-3 text-sm">
          Surface subtle
        </div>
        <div className="mt-2 rounded-md border border-line-default bg-surface-raised p-3 text-sm">
          Surface raised
        </div>
        <div className="mt-2 rounded-md bg-primary-subtle p-3 text-sm">Item terpilih</div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center text-sm font-medium">
        <div className="rounded-md bg-primary px-3 py-2 text-on-primary">Primary</div>
        <div className="rounded-md bg-primary-hover px-3 py-2 text-on-primary">Hover</div>
        <div className="rounded-md bg-primary-pressed px-3 py-2 text-on-primary">Pressed</div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        {statusSamples.map((status) => (
          <div
            className={`rounded-md px-3 py-2 text-sm font-medium ${status.className}`}
            key={status.name}
          >
            {status.name}
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line-default bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Seri chart 1–6</p>
        <div className="flex h-16 items-end gap-2">
          {chartSeries.map((series, index) => (
            <div
              aria-hidden="true"
              className={`flex-1 rounded-sm ${series}`}
              key={series}
              style={{ height: `${100 - index * 12}%` } as CSSProperties}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {merchantPresets.map((preset) => (
          <div
            className="rounded-md bg-brand px-3 py-2 text-center text-sm font-medium capitalize text-on-brand"
            data-brand-preset={preset}
            data-customer-storefront=""
            key={preset}
          >
            {preset}
          </div>
        ))}
      </section>

      <div className="rounded-md border border-line-control bg-surface px-3 py-2 text-sm ring-2 ring-focus ring-offset-2 ring-offset-canvas">
        Focus ring
      </div>
    </article>
  );
}

export default function ColorBankPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-default pb-4">
          <div>
            <Link className="text-sm text-foreground-secondary underline" href="/design-system">
              Design system
            </Link>
            <h1 className="mt-1 text-xl font-semibold">Color bank</h1>
          </div>
          <ThemeSwitcher />
        </header>

        <div className="grid gap-4 xl:grid-cols-2">
          <SemanticThemePreview mode="light" />
          <SemanticThemePreview mode="dark" />
        </div>

        {primitiveGroups.map((group) => (
          <PrimitivePalette group={group} key={group.name} />
        ))}
      </div>
    </main>
  );
}
