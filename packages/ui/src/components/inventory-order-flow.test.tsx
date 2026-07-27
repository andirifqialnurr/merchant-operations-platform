import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  OrderInventoryImpactPanel,
  OrderWasteCaptureForm,
  type OrderInventoryImpactRow,
  type OrderWasteItem,
  type OrderWasteUnitOption,
} from "./inventory-order-flow";

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

const unitOptions: OrderWasteUnitOption[] = [
  { label: "gram", value: "gram" },
  { label: "ml", value: "ml" },
];

const wasteItems: OrderWasteItem[] = [
  {
    availableQuantityLabel: "18 gram",
    itemLabel: "Biji kopi house blend",
    quantity: "2",
    rowId: "waste-coffee",
    unitOptions,
    unitValue: "gram",
  },
];

describe("Inventory order flow", () => {
  it("renders order consumption, reversal, and waste without sensitive POS or finance data", () => {
    render(
      <OrderInventoryImpactPanel
        orderLabel="Order A-014"
        rows={impactRows}
        sourceLabel="KDS bridge"
        statusLabel="Posted"
        tableLabel="Meja 7"
      />,
    );

    expect(screen.getByRole("region", { name: "Dampak stok order" })).toBeVisible();
    expect(screen.getAllByText("Order A-014").length).toBe(2);
    expect(screen.getByText("Consumption")).toBeVisible();
    expect(screen.getByText("Reversal")).toBeVisible();
    expect(screen.getByText("Waste")).toBeVisible();
    expect(screen.getByText("-18 gram")).toBeVisible();
    expect(screen.getByText("+120 ml")).toBeVisible();
    expect(screen.getByText("-12 ml")).toBeVisible();
    expect(
      screen.queryByText(/impact-coffee|payment|bill|customer|phone|hpp|cost|profit|payload/i),
    ).not.toBeInTheDocument();
  });

  it("emits review and acknowledge callbacks with hidden row IDs", async () => {
    const onReviewRow = vi.fn();
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();

    render(
      <OrderInventoryImpactPanel
        onAcknowledge={onAcknowledge}
        onReviewRow={onReviewRow}
        orderLabel="Order A-014"
        rows={impactRows}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Review waste" }));
    await user.click(screen.getByRole("button", { name: "Tandai ditinjau" }));

    expect(onReviewRow).toHaveBeenCalledWith("impact-syrup-waste");
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("captures order waste quantity, unit, and reason from user-owned fields", async () => {
    const onQuantityChange = vi.fn();
    const onUnitChange = vi.fn();
    const onReasonChange = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    function StatefulWasteForm() {
      const [items, setItems] = useState(wasteItems);
      const [reason, setReason] = useState("");

      return (
        <OrderWasteCaptureForm
          items={items}
          onQuantityChange={(rowId, quantity) => {
            setItems((currentItems) =>
              currentItems.map((item) => (item.rowId === rowId ? { ...item, quantity } : item)),
            );
            onQuantityChange(rowId, quantity);
          }}
          onReasonChange={(nextReason) => {
            setReason(nextReason);
            onReasonChange(nextReason);
          }}
          onSubmit={onSubmit}
          onUnitChange={(rowId, unit) => {
            setItems((currentItems) =>
              currentItems.map((item) =>
                item.rowId === rowId ? { ...item, unitValue: unit } : item,
              ),
            );
            onUnitChange(rowId, unit);
          }}
          orderLabel="Order A-014"
          reason={reason}
        />
      );
    }

    render(<StatefulWasteForm />);

    await user.clear(screen.getByLabelText("Waste quantity Biji kopi house blend"));
    await user.type(screen.getByLabelText("Waste quantity Biji kopi house blend"), "3gr");
    await user.selectOptions(screen.getByLabelText("Waste unit Biji kopi house blend"), "ml");
    await user.type(screen.getByLabelText("Reason"), "Tumpah saat plating");
    await user.click(screen.getByRole("button", { name: "Catat waste order" }));

    expect(onQuantityChange).toHaveBeenLastCalledWith("waste-coffee", "3");
    expect(onUnitChange).toHaveBeenCalledWith("waste-coffee", "ml");
    expect(onReasonChange).toHaveBeenLastCalledWith("Tumpah saat plating");
    expect(onSubmit).toHaveBeenCalledWith({
      items: [{ quantity: "3", rowId: "waste-coffee", unit: "ml" }],
      reason: "Tumpah saat plating",
    });
  });

  it("rejects sensitive order inventory fields before render", () => {
    expect(() =>
      render(
        <OrderInventoryImpactPanel
          {...({
            customerPhone: "08123",
            orderLabel: "Order A-014",
            rows: impactRows,
          } as Parameters<typeof OrderInventoryImpactPanel>[0] & { customerPhone: string })}
        />,
      ),
    ).toThrow(/customerPhone/);

    expect(() =>
      render(
        <OrderWasteCaptureForm
          {...({
            items: wasteItems,
            orderId: "order-internal",
            orderLabel: "Order A-014",
            reason: "Rusak",
          } as Parameters<typeof OrderWasteCaptureForm>[0] & { orderId: string })}
        />,
      ),
    ).toThrow(/orderId/);
  });

  it("rejects malformed order inventory data", () => {
    expect(() => render(<OrderInventoryImpactPanel orderLabel="" rows={impactRows} />)).toThrow(
      /label order/,
    );
    expect(() =>
      render(
        <OrderInventoryImpactPanel
          orderLabel="Order A-014"
          rows={[
            { ...impactRows[0]!, rowId: "same" },
            { ...impactRows[1]!, rowId: "same" },
          ]}
        />,
      ),
    ).toThrow(/unik/);
    expect(() =>
      render(
        <OrderWasteCaptureForm
          items={[{ ...wasteItems[0]!, unitOptions: [] }]}
          orderLabel="Order A-014"
          reason="Rusak"
        />,
      ),
    ).toThrow(/pilihan unit/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <OrderInventoryImpactPanel
          onAcknowledge={() => undefined}
          onReviewRow={() => undefined}
          orderLabel="Order A-014"
          rows={impactRows}
          sourceLabel="KDS bridge"
          statusLabel="Posted"
        />
        <OrderWasteCaptureForm
          items={wasteItems}
          onCancel={() => undefined}
          onQuantityChange={() => undefined}
          onReasonChange={() => undefined}
          onSubmit={() => undefined}
          onUnitChange={() => undefined}
          orderLabel="Order A-014"
          policyLabel="Waste dari order membutuhkan alasan."
          reason="Tumpah"
          warningLabel="Pastikan waste bukan cancellation reversal."
        />
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
