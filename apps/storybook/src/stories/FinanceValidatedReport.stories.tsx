import type { Meta, StoryObj } from "@storybook/react-vite";

import { FinanceValidatedReport } from "@merchant/ui/finance-validated-report";

import { storyContractParameters } from "./story-contract";

const reportProps = {
  metrics: [
    {
      amountMinor: "4850000",
      categoryLabel: "Sales",
      id: "metric-sales",
      kind: "sales",
      label: "Sales",
      noteLabel: "Dari transaksi valid",
      previousAmountMinor: "4200000",
      validation: "validated",
      validationLabel: "Tervalidasi",
    },
    {
      amountMinor: "925000",
      categoryLabel: "Expense",
      id: "metric-expense",
      kind: "expense",
      label: "Expense",
      noteLabel: "Expense operasional",
      previousAmountMinor: "875000",
      validation: "validated",
      validationLabel: "Tervalidasi",
    },
    {
      amountMinor: "3300000",
      categoryLabel: "Profit estimate",
      id: "metric-gross-profit",
      kind: "gross-profit",
      label: "Gross profit",
      noteLabel: "Sales revenue dikurangi HPP estimate",
      previousAmountMinor: "2800000",
      validation: "validated",
      validationLabel: "Tervalidasi",
    },
    {
      amountMinor: "2675000",
      categoryLabel: "Profit estimate",
      id: "metric-operating-profit",
      kind: "operating-profit",
      label: "Operating profit",
      noteLabel: "Gross profit dikurangi expense",
      previousAmountMinor: "2300000",
      validation: "validated",
      validationLabel: "Tervalidasi",
    },
  ],
  periodLabel: "Hari ini",
  sourceLabel: "Outlet Sudirman",
  statusLabel: "Validated only",
  trendPoints: [
    {
      id: "trend-sen",
      label: "Sen",
      values: {
        expense: "810000",
        "gross-profit": "2550000",
        "operating-profit": "2050000",
        sales: "3950000",
      },
    },
    {
      id: "trend-sel",
      label: "Sel",
      values: {
        expense: "875000",
        "gross-profit": "2800000",
        "operating-profit": "2300000",
        sales: "4200000",
      },
    },
    {
      id: "trend-rab",
      label: "Rab",
      values: {
        expense: "925000",
        "gross-profit": "3300000",
        "operating-profit": "2675000",
        sales: "4850000",
      },
    },
  ],
} as const;

function FinanceValidatedReportExample() {
  return <FinanceValidatedReport {...reportProps} />;
}

const meta = {
  title: "Domain/Finance/Validated Report",
  component: FinanceValidatedReport,
  args: reportProps,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FinanceValidatedReport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FinanceValidatedReportExample />,
};

export const TrendUnavailable: Story = {
  render: () => (
    <FinanceValidatedReport
      metrics={reportProps.metrics}
      periodLabel="Minggu ini"
      sourceLabel="Outlet Sudirman"
      statusLabel="Validated only"
      trendPoints={[
        {
          id: "trend-unavailable",
          label: "Minggu ini",
          values: { sales: null },
        },
      ]}
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-finance-report-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FinanceValidatedReportExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FinanceValidatedReportExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <FinanceValidatedReportExample />,
};
