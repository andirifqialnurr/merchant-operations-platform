import type { Meta, StoryObj } from "@storybook/react-vite";

import { MoneyDisplay } from "@merchant/ui/money-display";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Domain/Shared/Money Display",
  component: MoneyDisplay,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MoneyDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VariantsAndSizes: Story = {
  args: { amountMinor: 50_000 },
  render: () => (
    <div className="story-money-display-grid">
      <section>
        <span className="text-caption">Inline · md</span>
        <MoneyDisplay amountMinor={50_000} />
      </section>
      <section>
        <span className="text-caption">Summary · lg</span>
        <MoneyDisplay amountMinor={275_500} variant="summary" />
      </section>
      <section>
        <span className="text-caption">Total · xl</span>
        <MoneyDisplay amountMinor={1_250_000} variant="total" />
      </section>
      <section>
        <span className="text-caption">Accounting · sm</span>
        <MoneyDisplay amountMinor={-75_500} variant="accounting" />
      </section>
    </div>
  ),
};

export const FinancialStates: Story = {
  args: { amountMinor: 0 },
  render: () => (
    <div className="story-money-display-ledger" role="table" aria-label="State nominal">
      <div role="row">
        <span role="rowheader">Nilai nol nyata</span>
        <MoneyDisplay amountMinor={0} role="cell" variant="accounting" />
      </div>
      <div role="row">
        <span role="rowheader">Diskon</span>
        <MoneyDisplay amountMinor={-10_000} role="cell" variant="accounting" />
      </div>
      <div role="row">
        <span role="rowheader">Refund laporan</span>
        <MoneyDisplay
          amountMinor={-125_000}
          negativeFormat="parentheses"
          role="cell"
          variant="accounting"
        />
      </div>
      <div role="row">
        <span role="rowheader">Data belum tersedia</span>
        <MoneyDisplay
          amountMinor={null}
          role="cell"
          unavailableLabel="Nominal laporan belum tersedia"
          variant="accounting"
        />
      </div>
      <div role="row">
        <span role="rowheader">Nominal presisi besar</span>
        <MoneyDisplay amountMinor="900719925474099312345" role="cell" variant="accounting" />
      </div>
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: { amountMinor: 1_250_000 },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <MoneyDisplay amountMinor={1_250_000} variant="total" />
        <MoneyDisplay amountMinor={-50_000} variant="accounting" />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <MoneyDisplay amountMinor={1_250_000} variant="total" />
        <MoneyDisplay amountMinor={-50_000} variant="accounting" />
      </section>
    </div>
  ),
};

export const MobileReflow: Story = {
  args: { amountMinor: 1_250_000 },
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => (
    <div className="story-money-display-mobile">
      <span className="text-caption">Total pembayaran</span>
      <MoneyDisplay amountMinor="900719925474099312345" variant="total" />
      <span className="text-caption">Data unavailable tetap bukan nol</span>
      <MoneyDisplay amountMinor={null} unavailableLabel="Total belum tersedia" variant="summary" />
    </div>
  ),
};
