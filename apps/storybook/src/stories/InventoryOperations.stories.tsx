import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  StockOperationForm,
  StocktakeCountRow,
  type InventoryStockOperationType,
} from "@merchant/ui/inventory-operations";

import { storyContractParameters } from "./story-contract";

const unitOptions = [
  { label: "kg", value: "kg" },
  { label: "gram", value: "gram" },
  { label: "karung", value: "karung" },
] as const;

const resultingByType: Record<InventoryStockOperationType, string> = {
  adjustment: "15 kg",
  stocktake: "10 kg",
  "stock-in": "37 kg",
  "stock-out": "9 kg",
  transfer: "10 kg",
  waste: "9 kg",
};

function InventoryOperationDemo() {
  const [operationType, setOperationType] = useState<InventoryStockOperationType>("stock-in");
  const [quantity, setQuantity] = useState("25");
  const [countedQuantity, setCountedQuantity] = useState("10");
  const [unit, setUnit] = useState("kg");
  const [reference, setReference] = useState("GR-001");
  const [reason, setReason] = useState("Penyesuaian stok harian");
  const [destinationOutletLabel, setDestinationOutletLabel] = useState("Outlet BSD");
  const optionalStatusProps = {
    ...(operationType === "stocktake" ? { differenceLabel: "-2 kg" } : {}),
    ...(operationType === "waste"
      ? { negativeWarningLabel: "Waste ini perlu review manager." }
      : {}),
  };

  return (
    <div className="story-inventory-operations-workspace">
      <StockOperationForm
        {...optionalStatusProps}
        countedQuantity={countedQuantity}
        currentStockLabel="12"
        currentUnitLabel="kg"
        destinationOutletLabel={destinationOutletLabel}
        itemLabel="Beras premium"
        onCountedQuantityChange={setCountedQuantity}
        onDestinationOutletLabelChange={setDestinationOutletLabel}
        onOperationTypeChange={setOperationType}
        onQuantityChange={setQuantity}
        onReasonChange={setReason}
        onReferenceChange={setReference}
        onSubmit={() => undefined}
        onUnitChange={setUnit}
        operationType={operationType}
        policyLabel={
          operationType === "transfer"
            ? "Transfer hanya memindahkan stok antar outlet aktif."
            : "Reason wajib sebelum operasi disimpan."
        }
        quantity={quantity}
        reason={reason}
        reference={reference}
        resultingStockLabel={resultingByType[operationType]}
        unitOptions={unitOptions}
        unitValue={unit}
      />

      <section className="story-inventory-stocktake-rows">
        <StocktakeCountRow
          countedQuantity="10"
          differenceLabel="-2 kg"
          itemLabel="Beras premium"
          reasonLabel="Selisih fisik"
          statusLabel="Draft"
          systemQuantityLabel="12"
          unitLabel="kg"
        />
        <StocktakeCountRow
          countedQuantity="4"
          differenceLabel="0 botol"
          itemLabel="Sirup gula aren"
          statusLabel="Sesuai"
          systemQuantityLabel="4"
          unitLabel="botol"
        />
      </section>
    </div>
  );
}

const meta = {
  title: "Domain/Inventory/Operations",
  component: StockOperationForm,
  args: {
    currentStockLabel: "12",
    currentUnitLabel: "kg",
    itemLabel: "Beras premium",
    operationType: "stock-in",
    unitOptions,
    unitValue: "kg",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StockOperationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <InventoryOperationDemo />,
};

export const Transfer: Story = {
  render: () => (
    <StockOperationForm
      currentStockLabel="12"
      currentUnitLabel="kg"
      destinationOutletLabel="Outlet BSD"
      itemLabel="Beras premium"
      onSubmit={() => undefined}
      operationType="transfer"
      policyLabel="Transfer hanya memindahkan stok antar outlet aktif."
      quantity="2"
      reason="Pindah stok outlet"
      reference="TR-001"
      resultingStockLabel="10 kg"
      unitOptions={unitOptions}
      unitValue="kg"
    />
  ),
};

export const Stocktake: Story = {
  render: () => (
    <div className="story-inventory-operations-workspace">
      <StockOperationForm
        countedQuantity="10"
        currentStockLabel="12"
        currentUnitLabel="kg"
        differenceLabel="-2 kg"
        itemLabel="Beras premium"
        onSubmit={() => undefined}
        operationType="stocktake"
        reason="Opname akhir hari"
        resultingStockLabel="10 kg"
        unitOptions={unitOptions}
        unitValue="kg"
      />
      <StocktakeCountRow
        countedQuantity="10"
        differenceLabel="-2 kg"
        itemLabel="Beras premium"
        statusLabel="Draft"
        systemQuantityLabel="12"
        unitLabel="kg"
      />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-inventory-operations-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <InventoryOperationDemo />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <InventoryOperationDemo />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <InventoryOperationDemo />,
};
