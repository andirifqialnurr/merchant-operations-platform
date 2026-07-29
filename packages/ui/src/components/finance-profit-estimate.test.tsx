import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FinanceProfitEstimate } from "./finance-profit-estimate";

const estimateProps = {
  basisLabel: "Recipe aktif dan harga bahan terakhir yang tervalidasi",
  grossProfitEstimateMinor: "3300000",
  hppEstimateMinor: "1550000",
  operatingExpenseMinor: "925000",
  operatingProfitEstimateMinor: "2675000",
  otherIncomeMinor: "300000",
  periodLabel: "Hari ini",
  salesRevenueMinor: "4850000",
  sourceLabel: "Outlet Sudirman",
  statusLabel: "Estimasi",
} as const;

describe("FinanceProfitEstimate", () => {
  it("renders HPP, gross profit, and operating profit as read-only operational estimates", () => {
    render(<FinanceProfitEstimate {...estimateProps} />);

    expect(screen.getByRole("region", { name: "Ringkasan estimasi profit Finance" })).toBeVisible();
    expect(screen.getByText("HPP estimate")).toBeVisible();
    expect(screen.getByText("Gross profit")).toBeVisible();
    expect(screen.getByText("Operating profit")).toBeVisible();
    expect(screen.getByText("Rp1.550.000")).toBeVisible();
    expect(screen.getByText("Rp3.300.000")).toBeVisible();
    expect(screen.getByText("Rp2.675.000")).toBeVisible();
    expect(screen.getAllByText("Estimasi operasional")).toHaveLength(3);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(/payment|customer|phone|ledger|journal|invoice|receipt|token|vendor/i),
    ).not.toBeInTheDocument();
  });

  it("renders unavailable estimate rows without inventing zero", () => {
    render(
      <FinanceProfitEstimate
        grossProfitEstimateMinor={null}
        hppEstimateMinor={null}
        operatingProfitEstimateMinor={null}
        periodLabel="Minggu ini"
        salesRevenueMinor="2500000"
      />,
    );

    expect(screen.getByText("Rp2.500.000")).toBeVisible();
    expect(screen.getByText("HPP belum tersedia")).toBeInTheDocument();
    expect(screen.getByText("Gross profit belum tersedia")).toBeInTheDocument();
    expect(screen.getByText("Operating profit belum tersedia")).toBeInTheDocument();
    expect(screen.queryByText("Rp0")).not.toBeInTheDocument();
  });

  it("omits unconfigured rows", () => {
    render(<FinanceProfitEstimate hppEstimateMinor="1000000" periodLabel="Bulan ini" />);

    expect(screen.getByText("HPP estimate")).toBeVisible();
    expect(screen.queryByText("Sales revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Operating expense")).not.toBeInTheDocument();
  });

  it("rejects sensitive and raw costing payload before render", () => {
    expect(() =>
      render(
        <FinanceProfitEstimate
          {...({
            ...estimateProps,
            ingredientCostRows: [],
          } as Parameters<typeof FinanceProfitEstimate>[0] & { ingredientCostRows: unknown[] })}
        />,
      ),
    ).toThrow(/ingredientCostRows/);

    expect(() =>
      render(
        <FinanceProfitEstimate
          {...({
            ...estimateProps,
            ledgerId: "ledger-internal",
          } as Parameters<typeof FinanceProfitEstimate>[0] & { ledgerId: string })}
        />,
      ),
    ).toThrow(/ledgerId/);

    expect(() =>
      render(
        <FinanceProfitEstimate
          {...({
            ...estimateProps,
            onRecalculate: () => undefined,
          } as Parameters<typeof FinanceProfitEstimate>[0] & { onRecalculate: () => void })}
        />,
      ),
    ).toThrow(/onRecalculate/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<FinanceProfitEstimate {...estimateProps} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
