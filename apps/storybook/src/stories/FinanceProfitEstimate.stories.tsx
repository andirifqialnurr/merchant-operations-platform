import type { Meta, StoryObj } from "@storybook/react-vite";

import { FinanceProfitEstimate } from "@merchant/ui/finance-profit-estimate";

import { storyContractParameters } from "./story-contract";

const estimateProps = {
  basisLabel: "Recipe aktif dan harga bahan terakhir yang tervalidasi",
  grossProfitEstimateMinor: "3300000",
  hppEstimateMinor: "1550000",
  operatingExpenseMinor: "925000",
  operatingProfitEstimateMinor: "2675000",
  otherIncomeMinor: "300000",
  periodLabel: "Hari ini",
  salesRevenueMinor: "4850000",
  sourceLabel: "Outlet Sudirman",
  statusLabel: "Estimasi",
} as const;

function FinanceProfitEstimateExample() {
  return <FinanceProfitEstimate {...estimateProps} />;
}

const meta = {
  title: "Domain/Finance/Profit Estimate",
  component: FinanceProfitEstimate,
  args: estimateProps,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FinanceProfitEstimate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FinanceProfitEstimateExample />,
};

export const InventoryUnavailable: Story = {
  render: () => (
    <FinanceProfitEstimate
      grossProfitEstimateMinor={null}
      hppEstimateMinor={null}
      operatingProfitEstimateMinor={null}
      periodLabel="Minggu ini"
      salesRevenueMinor="2500000"
      sourceLabel="Outlet belum membuka inventory"
      statusLabel="Sebagian"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-finance-profit-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FinanceProfitEstimateExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FinanceProfitEstimateExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <FinanceProfitEstimateExample />,
};
