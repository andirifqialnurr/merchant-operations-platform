import type { Meta, StoryObj } from "@storybook/react-vite";

import { FinanceMetric, type FinanceMetricVariant } from "@merchant/ui/finance-metric";

import { storyContractParameters } from "./story-contract";

const metricExamples: Array<{
  amountMinor: number | null;
  contextLabel: string;
  delta?: {
    comparisonPeriodLabel: string;
    direction: "increase" | "decrease" | "flat";
    label: string;
  };
  statusLabel?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  variant: FinanceMetricVariant;
}> = [
  {
    amountMinor: 4_850_000,
    contextLabel: "Outlet Sudirman - Hari ini",
    delta: { comparisonPeriodLabel: "vs kemarin", direction: "increase", label: "Naik 12%" },
    statusLabel: "Terverifikasi",
    tone: "success",
    variant: "revenue",
  },
  {
    amountMinor: 1_250_000,
    contextLabel: "Recipe aktif",
    delta: { comparisonPeriodLabel: "vs minggu lalu", direction: "decrease", label: "Turun 4%" },
    tone: "info",
    variant: "hpp-estimate",
  },
  {
    amountMinor: 2_100_000,
    contextLabel: "Estimasi operasional",
    delta: { comparisonPeriodLabel: "vs minggu lalu", direction: "increase", label: "Naik 7%" },
    variant: "gross-profit",
  },
  {
    amountMinor: 925_000,
    contextLabel: "Expense operasional",
    delta: { comparisonPeriodLabel: "vs kemarin", direction: "flat", label: "Stabil" },
    tone: "warning",
    variant: "expense",
  },
  {
    amountMinor: 1_450_000,
    contextLabel: "Per outlet",
    delta: { comparisonPeriodLabel: "vs minggu lalu", direction: "increase", label: "Naik 5%" },
    variant: "operating-profit",
  },
  {
    amountMinor: -50_000,
    contextLabel: "Shift sore",
    statusLabel: "Perlu rekonsiliasi",
    tone: "danger",
    variant: "cash-variance",
  },
];

function FinanceMetricGrid() {
  return (
    <div className="story-finance-metric-grid">
      {metricExamples.map((metric) => (
        <FinanceMetric
          amountMinor={metric.amountMinor}
          contextLabel={metric.contextLabel}
          key={metric.variant}
          {...(metric.delta ? { delta: metric.delta } : {})}
          {...(metric.statusLabel ? { statusLabel: metric.statusLabel } : {})}
          {...(metric.tone ? { tone: metric.tone } : {})}
          variant={metric.variant}
        />
      ))}
    </div>
  );
}

const meta = {
  title: "Domain/Finance/Metric",
  component: FinanceMetric,
  args: {
    amountMinor: 4_850_000,
    contextLabel: "Outlet Sudirman - Hari ini",
    delta: { comparisonPeriodLabel: "vs kemarin", direction: "increase", label: "Naik 12%" },
    variant: "revenue",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FinanceMetric>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FinanceMetricGrid />,
};

export const Unavailable: Story = {
  render: () => (
    <FinanceMetric
      amountMinor={null}
      contextLabel="Inventory belum aktif"
      unavailableLabel="HPP belum tersedia"
      variant="hpp-estimate"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-finance-metric-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FinanceMetricGrid />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FinanceMetricGrid />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <FinanceMetricGrid />,
};
