import type { Meta, StoryObj } from "@storybook/react-vite";

import { FinanceReconciliationSummary } from "@merchant/ui/finance-reconciliation-summary";

import { storyContractParameters } from "./story-contract";

const reconciliationItems = [
  {
    actorLabel: "Nia Finance",
    differenceMinor: "0",
    expectedMinor: "2850000",
    id: "cash",
    label: "Tunai",
    notesLabel: "Kas cocok dengan hitungan shift.",
    recordedMinor: "2850000",
    statementLabel: "Laci kas",
    status: "matched",
  },
  {
    actorLabel: "Nia Finance",
    differenceMinor: "-15000",
    expectedMinor: "1225000",
    id: "qris",
    label: "QRIS merchant",
    notesLabel: "Menunggu bukti settle harian.",
    recordedMinor: "1210000",
    statementLabel: "Statement merchant",
    status: "difference",
  },
  {
    expectedMinor: "450000",
    id: "transfer",
    label: "Transfer bank",
    recordedMinor: null,
    statementLabel: "Statement bank",
    status: "pending",
  },
] as const;

const shiftSnapshot = {
  cashInMinor: "25000",
  cashOutMinor: "10000",
  cashSalesMinor: "2800000",
  closedAtLabel: "23 Jul 2026, 17.10",
  closedByLabel: "Ayu Pratama",
  countedCashMinor: "2865000",
  expectedCashMinor: "2865000",
  nonCashBreakdown: [{ amountMinor: "450000", id: "edc", label: "Kartu EDC" }],
  openedAtLabel: "23 Jul 2026, 08.00",
  openedByLabel: "Ayu Pratama",
  openingCashMinor: "50000",
  status: "closed",
  varianceMinor: "0",
  varianceVisible: true,
} as const;

function FinanceReconciliationExample() {
  return (
    <FinanceReconciliationSummary
      items={reconciliationItems}
      periodLabel="Hari ini"
      shift={shiftSnapshot}
      sourceLabel="Outlet Sudirman"
      statusLabel="Manual check"
    />
  );
}

const meta = {
  title: "Domain/Finance/Reconciliation Summary",
  component: FinanceReconciliationSummary,
  args: {
    items: reconciliationItems,
    periodLabel: "Hari ini",
    sourceLabel: "Outlet Sudirman",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FinanceReconciliationSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FinanceReconciliationExample />,
};

export const PartialData: Story = {
  render: () => (
    <FinanceReconciliationSummary
      items={[
        {
          expectedMinor: "450000",
          id: "transfer",
          label: "Transfer bank",
          recordedMinor: null,
          statementLabel: "Statement bank",
          status: "pending",
        },
      ]}
      periodLabel="Minggu ini"
      shift={{ ...shiftSnapshot, varianceVisible: false }}
      sourceLabel="Outlet belum lengkap"
      statusLabel="Sebagian"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-finance-reconciliation-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FinanceReconciliationExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FinanceReconciliationExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <FinanceReconciliationExample />,
};
