import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  OrderInventoryImpactPanel,
  OrderWasteCaptureForm,
  type OrderInventoryImpactRow,
  type OrderWasteItem,
  type OrderWasteUnitOption,
} from "@merchant/ui/inventory-order-flow";

import { storyContractParameters } from "./story-contract";

const impactRows: OrderInventoryImpactRow[] = [
  {
    itemLabel: "Biji kopi house blend",
    quantityLabel: "18",
    referenceLabel: "Order A-014",
    resultingBalanceLabel: "82",
    resultingUnitLabel: "gram",
    rowId: "impact-coffee",
    statusLabel: "Posted",
    type: "consumption",
    unitLabel: "gram",
  },
  {
    itemLabel: "Susu segar",
    quantityLabel: "120",
    referenceLabel: "Cancel A-014",
    resultingBalanceLabel: "5",
    resultingUnitLabel: "liter",
    rowId: "impact-milk-reversal",
    type: "reversal",
    unitLabel: "ml",
  },
  {
    itemLabel: "Sirup gula aren",
    quantityLabel: "12",
    reasonLabel: "Tumpah saat produksi",
    rowId: "impact-syrup-waste",
    type: "waste",
    unitLabel: "ml",
  },
];

const unitOptions = [
  { label: "gram", value: "gram" },
  { label: "ml", value: "ml" },
] as const satisfies readonly OrderWasteUnitOption[];

const baseWasteItems: OrderWasteItem[] = [
  {
    availableQuantityLabel: "18 gram",
    itemLabel: "Biji kopi house blend",
    quantity: "2",
    rowId: "waste-coffee",
    unitOptions,
    unitValue: "gram",
  },
  {
    availableQuantityLabel: "120 ml",
    itemLabel: "Susu segar",
    quantity: "20",
    rowId: "waste-milk",
    unitOptions,
    unitValue: "ml",
  },
];

function InventoryOrderFlowDemo() {
  const [wasteItems, setWasteItems] = useState(baseWasteItems);
  const [reason, setReason] = useState("Tumpah saat plating");

  return (
    <div className="story-inventory-order-flow-workspace">
      <OrderInventoryImpactPanel
        onAcknowledge={() => undefined}
        onReviewRow={() => undefined}
        orderLabel="Order A-014"
        rows={impactRows}
        sourceLabel="KDS bridge"
        statusLabel="Posted"
        summaryLabel="3 movement stok"
        tableLabel="Meja 7"
      />
      <OrderWasteCaptureForm
        items={wasteItems}
        onCancel={() => undefined}
        onQuantityChange={(rowId, quantity) =>
          setWasteItems((currentItems) =>
            currentItems.map((item) => (item.rowId === rowId ? { ...item, quantity } : item)),
          )
        }
        onReasonChange={setReason}
        onSubmit={() => undefined}
        onUnitChange={(rowId, unitValue) =>
          setWasteItems((currentItems) =>
            currentItems.map((item) => (item.rowId === rowId ? { ...item, unitValue } : item)),
          )
        }
        orderLabel="Order A-014"
        policyLabel="Waste dari order membutuhkan alasan dan tidak mengganti reversal cancellation."
        reason={reason}
        warningLabel="Pastikan item ini memang rusak atau tidak terpakai."
      />
    </div>
  );
}

const meta = {
  title: "Domain/Inventory/Order Flow",
  component: OrderInventoryImpactPanel,
  args: {
    orderLabel: "Order A-014",
    rows: impactRows,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof OrderInventoryImpactPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <InventoryOrderFlowDemo />,
};

export const Empty: Story = {
  render: () => <OrderInventoryImpactPanel orderLabel="Order A-018" rows={[]} />,
};

export const WasteOnly: Story = {
  render: () => (
    <OrderWasteCaptureForm
      items={baseWasteItems}
      onCancel={() => undefined}
      onQuantityChange={() => undefined}
      onReasonChange={() => undefined}
      onSubmit={() => undefined}
      onUnitChange={() => undefined}
      orderLabel="Order A-014"
      policyLabel="Waste dari order membutuhkan alasan."
      reason="Tumpah saat plating"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-inventory-order-flow-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <InventoryOrderFlowDemo />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <InventoryOrderFlowDemo />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <InventoryOrderFlowDemo />,
};
