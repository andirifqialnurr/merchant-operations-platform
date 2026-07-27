import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  StockOperationForm,
  StocktakeCountRow,
  type InventoryOperationUnitOption,
} from "./inventory-operations";

const unitOptions: InventoryOperationUnitOption[] = [
  { label: "kg", value: "kg" },
  { label: "gram", value: "gram" },
];

describe("Inventory operations", () => {
  it("renders stock operation form without internal or financial data", () => {
    render(
      <StockOperationForm
        currentStockLabel="12"
        currentUnitLabel="kg"
        itemLabel="Beras premium"
        operationType="stock-in"
        quantity="25"
        reason="Opening stock"
        resultingStockLabel="37 kg"
        unitOptions={unitOptions}
        unitValue="kg"
      />,
    );

    expect(screen.getByRole("form", { name: "Form operasi stok" })).toBeVisible();
    expect(screen.getAllByText("Stock in").length).toBeGreaterThan(0);
    expect(screen.getByText("Beras premium")).toBeVisible();
    expect(screen.getByText("12 kg")).toBeVisible();
    expect(screen.getByText("37 kg")).toBeVisible();
    expect(
      screen.queryByText(/internal|hpp|cost|price|profit|supplier|payment/i),
    ).not.toBeInTheDocument();
  });

  it("emits operation changes and submit payload from user-owned fields", async () => {
    const onOperationTypeChange = vi.fn();
    const onQuantityChange = vi.fn();
    const onReasonChange = vi.fn();
    const onReferenceChange = vi.fn();
    const onUnitChange = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    function StatefulOperationForm() {
      const [operationType, setOperationType] = useState<"stock-in" | "waste">("stock-in");
      const [quantity, setQuantity] = useState("");
      const [reason, setReason] = useState("Opening stock");
      const [reference, setReference] = useState("");
      const [unit, setUnit] = useState("kg");

      return (
        <StockOperationForm
          currentStockLabel="12"
          currentUnitLabel="kg"
          itemLabel="Beras premium"
          onOperationTypeChange={(nextType) => {
            if (nextType === "stock-in" || nextType === "waste") setOperationType(nextType);
            onOperationTypeChange(nextType);
          }}
          onQuantityChange={(nextQuantity) => {
            setQuantity(nextQuantity);
            onQuantityChange(nextQuantity);
          }}
          onReasonChange={(nextReason) => {
            setReason(nextReason);
            onReasonChange(nextReason);
          }}
          onReferenceChange={(nextReference) => {
            setReference(nextReference);
            onReferenceChange(nextReference);
          }}
          onSubmit={onSubmit}
          onUnitChange={(nextUnit) => {
            setUnit(nextUnit);
            onUnitChange(nextUnit);
          }}
          operationType={operationType}
          quantity={quantity}
          reason={reason}
          reference={reference}
          unitOptions={unitOptions}
          unitValue={unit}
        />
      );
    }

    render(<StatefulOperationForm />);

    await user.click(screen.getByRole("button", { name: /waste/i }));
    await user.type(screen.getByLabelText(/^Quantity$/i), "25kg");
    await user.selectOptions(screen.getByLabelText(/^Unit$/i), "gram");
    await user.type(screen.getByLabelText(/^Referensi$/i), "GR-001");
    await user.clear(screen.getByLabelText(/^Reason$/i));
    await user.type(screen.getByLabelText(/^Reason$/i), "Barang masuk");
    await user.click(screen.getByRole("button", { name: "Simpan operasi stok" }));

    expect(onOperationTypeChange).toHaveBeenCalledWith("waste");
    expect(onQuantityChange).toHaveBeenLastCalledWith("25");
    expect(onUnitChange).toHaveBeenCalledWith("gram");
    expect(onReferenceChange).toHaveBeenLastCalledWith("GR-001");
    expect(onReasonChange).toHaveBeenLastCalledWith("Barang masuk");
    expect(onSubmit).toHaveBeenCalledWith({
      operationType: "waste",
      quantity: "25",
      reason: "Barang masuk",
      reference: "GR-001",
      unit: "gram",
    });
  });

  it("renders transfer destination and submits transfer payload", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <StockOperationForm
        currentStockLabel="12"
        currentUnitLabel="kg"
        destinationOutletLabel="Outlet BSD"
        itemLabel="Beras premium"
        onSubmit={onSubmit}
        operationType="transfer"
        quantity="2"
        reason="Pindah stok outlet"
        reference="TR-001"
        unitOptions={unitOptions}
        unitValue="kg"
      />,
    );

    expect(screen.getByLabelText(/^Outlet tujuan$/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Simpan operasi stok" }));
    expect(onSubmit).toHaveBeenCalledWith({
      destinationOutletLabel: "Outlet BSD",
      operationType: "transfer",
      quantity: "2",
      reason: "Pindah stok outlet",
      reference: "TR-001",
      unit: "kg",
    });
  });

  it("renders stocktake form and count row", async () => {
    const onCountedQuantityChange = vi.fn();
    const user = userEvent.setup();

    render(
      <div>
        <StockOperationForm
          countedQuantity="10"
          currentStockLabel="12"
          currentUnitLabel="kg"
          differenceLabel="-2 kg"
          itemLabel="Beras premium"
          onCountedQuantityChange={onCountedQuantityChange}
          operationType="stocktake"
          reason="Opname akhir hari"
          unitOptions={unitOptions}
          unitValue="kg"
        />
        <StocktakeCountRow
          countedQuantity="10"
          differenceLabel="-2 kg"
          itemLabel="Beras premium"
          onCountedQuantityChange={onCountedQuantityChange}
          reasonLabel="Selisih fisik"
          statusLabel="Draft"
          systemQuantityLabel="12"
          unitLabel="kg"
        />
      </div>,
    );

    expect(screen.getAllByText("Opname").length).toBeGreaterThan(0);
    expect(screen.getByRole("article", { name: "Opname Beras premium" })).toBeVisible();
    expect(screen.getByText("System")).toBeVisible();
    expect(screen.getAllByText("12 kg").length).toBe(2);
    const countedInputs = screen.getAllByLabelText(/^Counted/i);
    await user.type(countedInputs[0]!, "5");
    expect(onCountedQuantityChange).toHaveBeenLastCalledWith("105");
  });

  it("rejects sensitive operation fields before render", () => {
    expect(() =>
      render(
        <StockOperationForm
          {...({
            averageCostMinor: "12000",
            currentStockLabel: "12",
            currentUnitLabel: "kg",
            itemLabel: "Beras premium",
            operationType: "stock-in",
            unitOptions,
            unitValue: "kg",
          } as Parameters<typeof StockOperationForm>[0] & { averageCostMinor: string })}
        />,
      ),
    ).toThrow(/averageCostMinor/);

    expect(() =>
      render(
        <StocktakeCountRow
          {...({
            auditActor: "manager-internal",
            itemLabel: "Beras premium",
            systemQuantityLabel: "12",
            unitLabel: "kg",
          } as Parameters<typeof StocktakeCountRow>[0] & { auditActor: string })}
        />,
      ),
    ).toThrow(/auditActor/);
  });

  it("rejects malformed operation data", () => {
    expect(() =>
      render(
        <StockOperationForm
          currentStockLabel=""
          currentUnitLabel="kg"
          itemLabel="Beras premium"
          operationType="stock-in"
          unitOptions={unitOptions}
          unitValue="kg"
        />,
      ),
    ).toThrow(/stok saat ini/);
    expect(() =>
      render(
        <StockOperationForm
          currentStockLabel="12"
          currentUnitLabel="kg"
          itemLabel="Beras premium"
          operationType="stock-in"
          unitOptions={[]}
          unitValue="kg"
        />,
      ),
    ).toThrow(/pilihan unit/);
    expect(() =>
      render(<StocktakeCountRow itemLabel="" systemQuantityLabel="12" unitLabel="kg" />),
    ).toThrow(/nama item/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <StockOperationForm
          currentStockLabel="12"
          currentUnitLabel="kg"
          itemLabel="Beras premium"
          negativeWarningLabel="Operasi ini akan menghasilkan stok negatif."
          operationType="waste"
          policyLabel="Manager approval diperlukan untuk waste besar."
          quantity="3"
          reason="Rusak"
          resultingStockLabel="9 kg"
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
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
