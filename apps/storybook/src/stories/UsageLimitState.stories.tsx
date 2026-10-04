import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@merchant/ui/button";
import { UsageLimitState, UsageMeter } from "@merchant/ui/usage-limit-state";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Patterns/UsageLimitState",
  component: UsageLimitState,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    action: <Button variant="secondary">Lihat langganan</Button>,
    description: "Paket ini memuat 50 produk aktif. Produk yang sudah ada tetap bisa dijual.",
    meter: {
      label: "Produk aktif",
      levelLabel: "Batas tercapai",
      limit: 50,
      used: 50,
      valueLabel: "50 dari 50",
    },
    title: "Batas produk tercapai",
  },
} satisfies Meta<typeof UsageLimitState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LimitReached: Story = {};

/** Cashiers and kitchen staff see no numbers and no billing invitation. */
export const WithoutBilling: Story = {
  render: (args) => (
    <UsageLimitState
      description="Hubungi pemilik bisnis untuk menambah kapasitas."
      title={args.title}
    />
  ),
};

/** The meter on its own, at every level of design-system.md 16.2. */
export const Meters: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--space-5)", maxInlineSize: "24rem" }}>
      <UsageMeter label="Produk aktif" limit={50} used={20} valueLabel="20 dari 50" />
      <UsageMeter
        label="Pengguna"
        levelLabel="Mendekati batas"
        limit={10}
        used={8}
        valueLabel="8 dari 10"
      />
      <UsageMeter
        label="Outlet"
        levelLabel="Hampir habis"
        limit={20}
        used={19}
        valueLabel="19 dari 20"
      />
      <UsageMeter
        label="Peran buatan sendiri"
        levelLabel="Batas tercapai"
        limit={5}
        used={5}
        valueLabel="5 dari 5"
      />
      <UsageMeter
        label="Penjualan periode ini"
        levelLabel="Melebihi kuota"
        limit={1000}
        note="Reset 1 Nov 2026"
        used={1200}
        valueLabel="1.200 dari 1.000"
      />
      <UsageMeter label="Brand" limit={null} used={3} valueLabel="3, tanpa batas" />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: (args) => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <UsageLimitState {...args} />
      </section>
      <section data-theme-preview="dark">
        <UsageLimitState {...args} />
      </section>
    </div>
  ),
};
