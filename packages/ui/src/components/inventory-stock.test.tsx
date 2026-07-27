import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { MovementTypeBadge, StockIndicator, StockMovementRow } from "./inventory-stock";

describe("Inventory stock components", () => {
  it("renders stock quantity and status without internal or financial data", () => {
    render(<StockIndicator quantityLabel="12" status="normal" unitLabel="kg" />);

    expect(screen.getByRole("region", { name: /Indikator stok/ })).toBeVisible();
    expect(screen.getByText("12 kg")).toBeVisible();
    expect(screen.getByText("Stok tersedia")).toBeVisible();
    expect(screen.queryByText(/internal|hpp|cost|price|profit|payment/i)).not.toBeInTheDocument();
  });

  it("renders negative stock with minus sign and danger state", () => {
    render(<StockIndicator quantityLabel="-2" status="negative" unitLabel="kg" />);

    expect(screen.getByText("-2 kg")).toBeVisible();
    expect(screen.getByText("Stok negatif")).toBeVisible();
    expect(screen.getByRole("region")).toHaveClass("ui-stock-indicator--negative");
  });

  it("renders delta with explicit plus and minus signs", () => {
    const { rerender } = render(
      <StockIndicator
        delta={{ direction: "increase", quantityLabel: "8", unitLabel: "kg" }}
        status="normal"
        variant="delta"
      />,
    );

    expect(screen.getByText("+8 kg")).toBeVisible();

    rerender(
      <StockIndicator
        delta={{ direction: "decrease", quantityLabel: "3", unitLabel: "kg" }}
        status="low"
        variant="delta"
      />,
    );

    expect(screen.getByText("-3 kg")).toBeVisible();
  });

  it("renders movement type badge mapping", () => {
    render(
      <div>
        <MovementTypeBadge type="receipt" />
        <MovementTypeBadge type="consumption" />
        <MovementTypeBadge type="reversal" />
        <MovementTypeBadge type="waste" />
        <MovementTypeBadge type="adjustment" />
        <MovementTypeBadge type="transfer-in" />
        <MovementTypeBadge type="transfer-out" />
      </div>,
    );

    expect(screen.getByText("Receipt")).toBeVisible();
    expect(screen.getByText("Consumption")).toBeVisible();
    expect(screen.getByText("Reversal")).toBeVisible();
    expect(screen.getByText("Waste")).toBeVisible();
    expect(screen.getByText("Adjustment")).toBeVisible();
    expect(screen.getByText("Transfer masuk")).toBeVisible();
    expect(screen.getByText("Transfer keluar")).toBeVisible();
  });

  it("renders stock movement row as read-only context", () => {
    render(
      <StockMovementRow
        actorLabel="Inventory Staff"
        delta={{ direction: "increase", quantityLabel: "25", unitLabel: "kg" }}
        itemLabel="Beras premium"
        referenceLabel="GR-001"
        resultingBalanceLabel="37"
        resultingUnitLabel="kg"
        timeLabel="20:15"
        type="receipt"
      />,
    );

    expect(screen.getByRole("article", { name: "Stock movement Beras premium" })).toBeVisible();
    expect(screen.getByText("20:15")).toBeVisible();
    expect(screen.getByText("Beras premium")).toBeVisible();
    expect(screen.getByText("Receipt")).toBeVisible();
    expect(screen.getByText("+25 kg")).toBeVisible();
    expect(screen.getByText("GR-001")).toBeVisible();
    expect(screen.getByText("Inventory Staff")).toBeVisible();
    expect(screen.getByText("Saldo 37 kg")).toBeVisible();
    expect(
      screen.queryByText(/movement-internal|item-internal|hpp|cost|price|supplier/i),
    ).not.toBeInTheDocument();
  });

  it("rejects sensitive stock fields before render", () => {
    expect(() =>
      render(
        <StockIndicator
          {...({
            averageCostMinor: "12000",
            quantityLabel: "12",
            status: "normal",
            unitLabel: "kg",
          } as Parameters<typeof StockIndicator>[0] & { averageCostMinor: string })}
        />,
      ),
    ).toThrow(/averageCostMinor/);

    expect(() =>
      render(
        <StockMovementRow
          {...({
            actorId: "user-internal",
            delta: { direction: "increase", quantityLabel: "25", unitLabel: "kg" },
            itemLabel: "Beras premium",
            rawTimestamp: "2026-07-27T12:00:00Z",
            timeLabel: "20:15",
            type: "receipt",
          } as Parameters<typeof StockMovementRow>[0] & {
            actorId: string;
            rawTimestamp: string;
          })}
        />,
      ),
    ).toThrow(/actorId/);
  });

  it("rejects malformed stock display values", () => {
    expect(() => render(<StockIndicator quantityLabel="12" status="normal" />)).toThrow(
      /unit label/,
    );
    expect(() =>
      render(<StockIndicator quantityLabel="2" status="negative" unitLabel="kg" />),
    ).toThrow(/tanda minus/);
    expect(() =>
      render(
        <StockMovementRow
          delta={{ direction: "decrease", quantityLabel: "", unitLabel: "kg" }}
          itemLabel="Beras"
          timeLabel="20:15"
          type="consumption"
        />,
      ),
    ).toThrow(/quantity delta/);
    expect(() =>
      render(
        <StockMovementRow
          delta={{ direction: "increase", quantityLabel: "1", unitLabel: "kg" }}
          itemLabel="Beras"
          resultingUnitLabel="kg"
          timeLabel="20:15"
          type="receipt"
        />,
      ),
    ).toThrow(/resulting balance/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <StockIndicator quantityLabel="12" status="normal" unitLabel="kg" />
        <StockIndicator
          delta={{ direction: "decrease", quantityLabel: "3", unitLabel: "kg" }}
          status="low"
          variant="delta"
        />
        <StockMovementRow
          actorLabel="Inventory Staff"
          delta={{ direction: "decrease", quantityLabel: "3", unitLabel: "kg" }}
          itemLabel="Beras premium"
          referenceLabel="Order A-014"
          resultingBalanceLabel="9"
          resultingUnitLabel="kg"
          timeLabel="20:18"
          type="consumption"
        />
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
