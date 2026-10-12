import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  emptyQuickItem,
  QuickItemEntry,
  type QuickItem,
  type QuickItemEntryLabels,
} from "@merchant/ui/quick-item-entry";

import { storyContractParameters } from "./story-contract";

const labels: QuickItemEntryLabels = {
  add: "Tambah item",
  decrease: "Kurangi",
  increase: "Tambah",
  item: (position) => `Item ${position}`,
  name: "Nama item",
  note: "Catatan",
  quantity: "Jumlah",
  remove: (position) => `Hapus item ${position}`,
};

const filled: QuickItem[] = [
  { key: "a", name: "Nasi goreng kampung", note: "pedas, tanpa bawang", quantity: 2 },
  { key: "b", name: "Es teh tawar", note: "", quantity: 1 },
];

function Demo({
  disabled,
  error,
  start,
}: Readonly<{ disabled?: boolean; error?: string; start: QuickItem[] }>) {
  const [items, setItems] = useState(start);
  return (
    <div style={{ color: "var(--color-text-primary)", maxWidth: "28rem" }}>
      <QuickItemEntry
        {...(disabled ? { disabled } : {})}
        {...(error ? { error } : {})}
        items={items}
        labels={labels}
        onItemsChange={setItems}
      />
    </div>
  );
}

const meta = {
  title: "Domain/KDS/Quick Item Entry",
  component: QuickItemEntry,
  args: { items: filled, labels, onItemsChange: () => undefined },
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof QuickItemEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { render: () => <Demo start={[emptyQuickItem()]} /> };

export const Filled: Story = { render: () => <Demo start={filled} /> };

export const Invalid: Story = {
  render: () => <Demo error="Isi minimal satu item." start={[emptyQuickItem()]} />,
};

export const Disabled: Story = { render: () => <Demo disabled start={filled} /> };

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <Demo start={filled} />
      </section>
      <section data-theme-preview="dark">
        <Demo start={filled} />
      </section>
    </div>
  ),
};
