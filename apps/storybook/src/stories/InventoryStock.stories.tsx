import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  StockIndicator,
  StockMovementRow,
  type InventoryMovementType,
  type InventoryStockStatus,
} from "@merchant/ui/inventory-stock";

import { storyContractParameters } from "./story-contract";

const stockStatuses: readonly InventoryStockStatus[] = [
  "normal",
  "low",
  "out",
  "negative",
  "unavailable",
];

const movements: ReadonlyArray<{
  actorLabel: string;
  direction: "increase" | "decrease";
  itemLabel: string;
  quantityLabel: string;
  referenceLabel: string;
  resultingBalanceLabel: string;
  timeLabel: string;
  type: InventoryMovementType;
}> = [
  {
    actorLabel: "Inventory Staff",
    direction: "increase",
    itemLabel: "Beras premium",
    quantityLabel: "25",
    referenceLabel: "GR-001",
    resultingBalanceLabel: "37",
    timeLabel: "20:15",
    type: "receipt",
  },
  {
    actorLabel: "Kitchen Bridge",
    direction: "decrease",
    itemLabel: "Sirup gula aren",
    quantityLabel: "1",
    referenceLabel: "Order A-014",
    resultingBalanceLabel: "2",
    timeLabel: "20:18",
    type: "consumption",
  },
  {
    actorLabel: "Manager",
    direction: "decrease",
    itemLabel: "Susu segar",
    quantityLabel: "2",
    referenceLabel: "Waste W-004",
    resultingBalanceLabel: "-1",
    timeLabel: "20:24",
    type: "waste",
  },
];

function InventoryStockDemo() {
  return (
    <div className="story-inventory-stock-workspace">
      <section className="story-inventory-stock-indicators">
        <StockIndicator quantityLabel="12" status="normal" unitLabel="kg" />
        <StockIndicator quantityLabel="2" status="low" unitLabel="botol" />
        <StockIndicator quantityLabel="0" status="out" unitLabel="pcs" />
        <StockIndicator quantityLabel="-1" status="negative" unitLabel="kg" />
        <StockIndicator status="unavailable" variant="status" />
        <StockIndicator
          delta={{ direction: "increase", quantityLabel: "25", unitLabel: "kg" }}
          status="normal"
          variant="delta"
        />
        <StockIndicator
          delta={{ direction: "decrease", quantityLabel: "3", unitLabel: "kg" }}
          status="low"
          variant="delta"
        />
      </section>

      <section className="story-inventory-stock-movements">
        {movements.map((movement) => (
          <StockMovementRow
            actorLabel={movement.actorLabel}
            delta={{
              direction: movement.direction,
              quantityLabel: movement.quantityLabel,
              unitLabel: movement.type === "consumption" ? "botol" : "kg",
            }}
            itemLabel={movement.itemLabel}
            key={`${movement.timeLabel}-${movement.itemLabel}`}
            referenceLabel={movement.referenceLabel}
            resultingBalanceLabel={movement.resultingBalanceLabel}
            resultingUnitLabel={movement.type === "consumption" ? "botol" : "kg"}
            timeLabel={movement.timeLabel}
            type={movement.type}
          />
        ))}
      </section>
    </div>
  );
}

const meta = {
  title: "Domain/Inventory/Stock",
  component: StockIndicator,
  args: {
    quantityLabel: "12",
    status: "normal",
    unitLabel: "kg",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StockIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <InventoryStockDemo />,
};

export const Statuses: Story = {
  render: () => (
    <div className="story-inventory-stock-indicators">
      {stockStatuses.map((status) =>
        status === "unavailable" ? (
          <StockIndicator key={status} status={status} variant="status" />
        ) : (
          <StockIndicator
            key={status}
            quantityLabel={status === "negative" ? "-2" : "12"}
            status={status}
            unitLabel="kg"
          />
        ),
      )}
    </div>
  ),
};

export const MovementRows: Story = {
  render: () => (
    <section className="story-inventory-stock-movements">
      {movements.map((movement) => (
        <StockMovementRow
          actorLabel={movement.actorLabel}
          delta={{
            direction: movement.direction,
            quantityLabel: movement.quantityLabel,
            unitLabel: movement.type === "consumption" ? "botol" : "kg",
          }}
          itemLabel={movement.itemLabel}
          key={`${movement.timeLabel}-${movement.itemLabel}`}
          referenceLabel={movement.referenceLabel}
          resultingBalanceLabel={movement.resultingBalanceLabel}
          resultingUnitLabel={movement.type === "consumption" ? "botol" : "kg"}
          timeLabel={movement.timeLabel}
          type={movement.type}
        />
      ))}
    </section>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-inventory-stock-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <InventoryStockDemo />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <InventoryStockDemo />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <InventoryStockDemo />,
};
