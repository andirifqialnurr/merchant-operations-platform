import type { Meta, StoryObj } from "@storybook/react-vite";

import { FinanceBasicSummary } from "@merchant/ui/finance-basic-summary";

import { storyContractParameters } from "./story-contract";

const financeBasicEntries = [
  {
    amountMinor: "4850000",
    contextLabel: "Bill valid hari ini",
    countLabel: "42 transaksi",
    id: "sales",
    kind: "sales",
    statusLabel: "Otomatis",
  },
  {
    amountMinor: "925000",
    contextLabel: "Operasional manual",
    countLabel: "6 dokumen",
    id: "expense",
    kind: "expense",
  },
  {
    amountMinor: "300000",
    contextLabel: "Pemasukan non-penjualan",
    countLabel: "2 catatan",
    id: "other-income",
    kind: "other-income",
  },
  {
    amountMinor: "4225000",
    contextLabel: "Kas operasional berjalan",
    countLabel: "Saldo akhir",
    id: "cashbook",
    kind: "cashbook",
  },
] as const;

function FinanceBasicExample() {
  return (
    <FinanceBasicSummary
      cashbook={{
        cashInMinor: "5150000",
        cashOutMinor: "900000",
        closingBalanceMinor: "4250000",
        openingBalanceMinor: "0",
      }}
      entries={financeBasicEntries}
      periodLabel="Hari ini"
      sourceLabel="Outlet Sudirman"
      statusLabel="Tersinkron"
    />
  );
}

const meta = {
  title: "Domain/Finance/Basic Summary",
  component: FinanceBasicSummary,
  args: {
    entries: financeBasicEntries,
    periodLabel: "Hari ini",
    sourceLabel: "Outlet Sudirman",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FinanceBasicSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FinanceBasicExample />,
};

export const PartialData: Story = {
  render: () => (
    <FinanceBasicSummary
      cashbook={{ closingBalanceMinor: "125000" }}
      entries={financeBasicEntries.filter((entry) => entry.kind !== "other-income")}
      periodLabel="Minggu ini"
      sourceLabel="Outlet belum lengkap"
      statusLabel="Sebagian"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-finance-basic-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FinanceBasicExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FinanceBasicExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <FinanceBasicExample />,
};
