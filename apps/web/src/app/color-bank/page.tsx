import type { CSSProperties } from "react";

import Link from "next/link";

type PrimitiveGroup = {
  name: string;
  description: string;
  tokens: string[];
};

const primitiveGroups: PrimitiveGroup[] = [
  {
    name: "Operational Teal",
    description: "Palet aksi utama platform.",
    tokens: [
      "teal-50",
      "teal-100",
      "teal-200",
      "teal-300",
      "teal-400",
      "teal-500",
      "teal-600",
      "teal-700",
      "teal-800",
      "teal-900",
      "teal-950",
    ],
  },
  {
    name: "Slate Neutral",
    description: "Canvas, surface, teks, dan border.",
    tokens: [
      "white",
      "slate-50",
      "slate-100",
      "slate-200",
      "slate-300",
      "slate-400",
      "slate-500",
      "slate-600",
      "slate-700",
      "slate-800",
      "slate-900",
      "slate-950",
    ],
  },
  {
    name: "Status & Storefront",
    description: "Stop terbatas untuk status semantic dan preset merchant.",
    tokens: [
      "blue-50",
      "blue-300",
      "blue-400",
      "blue-700",
      "blue-950",
      "indigo-400",
      "indigo-700",
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
      "violet-50",
      "violet-300",
      "violet-400",
      "violet-700",
      "violet-950",
      "rose-400",
      "rose-700",
      "orange-400",
      "orange-700",
    ],
  },
];

const merchantPresets = ["teal", "blue", "indigo", "violet", "rose", "orange"] as const;

const statusSamples = [
  { name: "Informasi", className: "bg-info-surface text-info" },
  { name: "Berhasil", className: "bg-success-surface text-success" },
  { name: "Peringatan", className: "bg-warning-surface text-warning" },
  { name: "Bahaya", className: "bg-danger-surface text-danger" },
  { name: "Khusus / refund", className: "bg-special-surface text-special" },
];

function PrimitivePalette({ group }: Readonly<{ group: PrimitiveGroup }>) {
  return (
    <section className="rounded-2xl border border-line-default bg-surface p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{group.name}</h2>
        <p className="mt-1 text-sm text-foreground-muted">{group.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {group.tokens.map((token) => (
          <div
            className="overflow-hidden rounded-xl border border-line-default bg-surface"
            key={token}
          >
            <div
              aria-hidden="true"
              className="h-20"
              style={{ backgroundColor: `var(--primitive-color-${token})` } as CSSProperties}
            />
            <div className="border-t border-line-subtle px-3 py-2 text-xs font-medium">{token}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusList() {
  return (
    <div className="grid gap-2">
      {statusSamples.map((status) => (
        <div
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${status.className}`}
          key={status.name}
        >
          {status.name}
        </div>
      ))}
    </div>
  );
}

function MerchantPresetList() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {merchantPresets.map((preset) => (
        <div
          className="rounded-lg bg-brand px-3 py-3 text-center text-sm font-semibold capitalize text-on-brand"
          data-brand-preset={preset}
          data-customer-storefront=""
          key={preset}
        >
          {preset}
        </div>
      ))}
    </div>
  );
}

function SemanticThemePreview({ mode }: Readonly<{ mode: "light" | "dark" }>) {
  const isDark = mode === "dark";

  return (
    <article
      className="rounded-2xl border border-line-default bg-canvas p-5 text-foreground"
      data-theme-preview={mode}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Semantic theme
          </p>
          <h3 className="mt-1 text-xl font-semibold">{isDark ? "Dark / Navy Slate" : "Light"}</h3>
        </div>
        <span className="rounded-full border border-line-control bg-surface px-3 py-1 text-xs font-medium">
          {isDark ? "data-theme=dark" : "default"}
        </span>
      </div>

      <div className="grid gap-4">
        <section className="rounded-xl border border-line-default bg-surface p-4">
          <p className="font-semibold">Surface utama</p>
          <p className="mt-1 text-sm text-foreground-secondary">
            Teks sekunder pada panel operasional.
          </p>
          <p className="mt-2 text-xs text-foreground-muted">Helper text / metadata</p>
          <div className="mt-4 rounded-lg border border-line-subtle bg-surface-subtle p-3 text-sm">
            Surface subtle dengan border subtle
          </div>
          <div className="mt-3 rounded-lg border border-line-strong bg-surface-raised p-3 text-sm">
            Surface raised dengan border strong
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-primary px-3 py-3 text-center text-sm font-semibold text-on-primary">
            Primary
          </div>
          <div className="rounded-lg bg-primary-hover px-3 py-3 text-center text-sm font-semibold text-on-primary">
            Hover
          </div>
          <div className="rounded-lg bg-primary-pressed px-3 py-3 text-center text-sm font-semibold text-on-primary">
            Pressed
          </div>
          <div className="rounded-lg bg-primary-subtle px-3 py-3 text-center text-sm font-semibold text-foreground">
            Primary subtle
          </div>
        </section>

        <section className="rounded-xl border border-line-default bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">Status selalu memakai label</p>
          <StatusList />
        </section>

        <section className="rounded-xl border border-line-default bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">Merchant storefront presets</p>
          <MerchantPresetList />
        </section>

        <section className="rounded-xl border border-line-default bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">Focus indicator</p>
          <div className="rounded-lg border border-line-control bg-surface px-3 py-3 text-sm ring-2 ring-focus ring-offset-2 ring-offset-surface">
            Control dengan focus ring semantic
          </div>
        </section>
      </div>
    </article>
  );
}

export default function ColorBankPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-line-default pb-6">
          <Link className="text-sm font-medium text-primary underline" href="/">
            Kembali ke workspace
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary">
            Development preview
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Color Bank</h1>
          <p className="mt-3 max-w-3xl text-foreground-secondary">
            Source of truth visual untuk primitive palette, semantic theme light/dark, status, dan
            preset warna storefront merchant.
          </p>
        </header>

        <div className="grid gap-6">
          {primitiveGroups.map((group) => (
            <PrimitivePalette group={group} key={group.name} />
          ))}
        </div>

        <section className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Side-by-side verification
            </p>
            <h2 className="mt-1 text-2xl font-bold">Semantic light dan dark</h2>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <SemanticThemePreview mode="light" />
            <SemanticThemePreview mode="dark" />
          </div>
        </section>
      </div>
    </main>
  );
}
