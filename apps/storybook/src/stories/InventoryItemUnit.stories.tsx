import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  InventoryItemPicker,
  InventoryUnitConversionList,
  type InventoryItemOption,
} from "@merchant/ui/inventory-item-unit";

import { storyContractParameters } from "./story-contract";

const itemOptions: readonly InventoryItemOption[] = [
  {
    id: "item-rice-internal",
    name: "Beras premium",
    primaryUnit: "kg",
    sku: "ING-RICE",
    status: "active",
    stockLabel: "12 kg",
    stockStatus: "normal",
  },
  {
    id: "item-syrup-internal",
    name: "Sirup gula aren",
    primaryUnit: "botol",
    sku: "ING-SYRUP",
    status: "active",
    stockLabel: "2 botol",
    stockStatus: "low",
  },
  {
    id: "item-flour-internal",
    name: "Tepung roti stok pusat",
    primaryUnit: "kg",
    sku: "ING-FLOUR",
    status: "inactive",
    stockStatus: "unavailable",
  },
  {
    disabled: true,
    disabledReason: "Tidak dipakai outlet ini",
    id: "item-packaging-internal",
    name: "Kemasan lama",
    primaryUnit: "pcs",
    status: "archived",
  },
];

function InventoryItemUnitDemo() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("item-rice-internal");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? itemOptions.filter(
        (item) =>
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.sku?.toLowerCase().includes(normalizedQuery),
      )
    : itemOptions;

  return (
    <div className="story-inventory-item-unit-workspace">
      <InventoryItemPicker
        items={visibleItems}
        onQueryChange={setQuery}
        onSelectItem={setSelectedId}
        query={query}
        selectedId={selectedId}
      />
      <InventoryUnitConversionList
        conversions={[
          {
            fromQuantity: "1",
            fromUnit: "karung",
            id: "unit-sack-internal",
            label: "Konversi pembelian",
            toQuantity: "25",
            toUnit: "kg",
          },
          {
            fromQuantity: "1",
            fromUnit: "kg",
            id: "unit-gram-internal",
            label: "Unit resep",
            toQuantity: "1000",
            toUnit: "gram",
          },
        ]}
        primaryUnit="kg"
      />
    </div>
  );
}

const meta = {
  title: "Domain/Inventory/Item and Unit",
  component: InventoryItemPicker,
  args: {
    items: itemOptions,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InventoryItemPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <InventoryItemUnitDemo />,
};

export const Empty: Story = {
  render: () => (
    <div className="story-inventory-item-unit-workspace">
      <InventoryItemPicker items={[]} query="xyz" />
      <InventoryUnitConversionList conversions={[]} primaryUnit="pcs" />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-inventory-item-unit-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <InventoryItemUnitDemo />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <InventoryItemUnitDemo />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <InventoryItemUnitDemo />,
};
