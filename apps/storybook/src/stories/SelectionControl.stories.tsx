import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Checkbox,
  QuantityStepper,
  Radio,
  SegmentedControl,
  Switch,
} from "@merchant/ui/selection-control";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Primitives/Selection control",
  component: Checkbox,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  args: { label: "Selection control" },
  render: () => (
    <div className="story-contract-page">
      <Checkbox label="Pilih semua pesanan aktif" />
      <Checkbox checked indeterminate label="Sebagian pesanan dipilih" readOnly />
      <Checkbox disabled label="Aksi tidak tersedia" />
      <Radio defaultChecked label="Dine-in" name="service" />
      <Radio label="Takeaway" name="service" />
      <Switch label="Terima pesanan baru" defaultChecked />
    </div>
  ),
};
export const SizesAndInteraction: Story = {
  args: { label: "Selection control" },
  render: () => (
    <div className="story-contract-page">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div className="story-contract-grid" key={size}>
          <Checkbox label={`Checkbox ${size}`} size={size} />
          <Switch label={`Switch ${size}`} size={size} />
          <QuantityStepper defaultValue={1} label={`Jumlah ${size}`} size={size} />
        </div>
      ))}
      <SegmentedControl
        defaultValue="dine-in"
        items={[
          { label: "Dine-in", value: "dine-in" },
          { label: "Takeaway", value: "takeaway" },
        ]}
        label="Tipe layanan"
      />
    </div>
  ),
};
export const ThemeComparison: Story = {
  args: { label: "Selection control" },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <Checkbox label="Tampilkan stok kosong" defaultChecked />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <Checkbox label="Tampilkan stok kosong" defaultChecked />
      </section>
    </div>
  ),
};
