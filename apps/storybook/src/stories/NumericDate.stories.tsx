import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DatePicker,
  DateRangePicker,
  MoneyInput,
  MonthPicker,
  NumericInput,
  TimeInput,
} from "@merchant/ui/numeric-date";
import { storyContractParameters } from "./story-contract";
const meta = {
  title: "Primitives/Numeric and date",
  component: NumericInput,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof NumericInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NumericAndMoney: Story = {
  args: { "aria-label": "Jumlah", value: "12" },
  render: () => (
    <div className="story-contract-page">
      <NumericInput aria-label="Jumlah integer" value="12" />
      <NumericInput allowDecimal aria-label="Berat" value="1,25" />
      <MoneyInput aria-label="Harga jual" value={50000} />
      <NumericInput aria-label="Jumlah tidak valid" invalid value="" />
    </div>
  ),
};
export const DateAndTime: Story = {
  args: { "aria-label": "Jumlah", value: "" },
  render: () => (
    <div className="story-contract-page">
      <DatePicker label="Tanggal transaksi" value="2026-07-17" />
      <DateRangePicker end="2026-07-31" label="Periode laporan" start="2026-07-01" />
      <MonthPicker label="Bulan laporan" value="2026-07" />
      <TimeInput label="Jam operasional" value="18:30" />
    </div>
  ),
};
export const ThemeComparison: Story = {
  args: { "aria-label": "Jumlah", value: "" },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <MoneyInput aria-label="Harga light" value={50000} />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <MoneyInput aria-label="Harga dark" value={50000} />
      </section>
    </div>
  ),
};
