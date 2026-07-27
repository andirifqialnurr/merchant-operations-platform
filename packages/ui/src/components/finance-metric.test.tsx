import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FinanceMetric } from "./finance-metric";

describe("FinanceMetric", () => {
  it("renders finance metric value, context, and comparison period", () => {
    render(
      <FinanceMetric
        amountMinor={4_850_000}
        contextLabel="Outlet Sudirman - Hari ini"
        delta={{ comparisonPeriodLabel: "vs kemarin", direction: "increase", label: "Naik 12%" }}
        statusLabel="Terverifikasi"
        variant="revenue"
      />,
    );

    expect(screen.getByRole("region", { name: "Finance metric Revenue" })).toBeVisible();
    expect(screen.getByText("Revenue")).toBeVisible();
    expect(screen.getByText("Outlet Sudirman - Hari ini")).toBeVisible();
    expect(screen.getByText("Rp4.850.000")).toBeVisible();
    expect(screen.getByText("Naik 12%")).toBeVisible();
    expect(screen.getByText("vs kemarin")).toBeVisible();
    expect(
      screen.queryByText(/payment|customer|phone|internal|raw|ledger/i),
    ).not.toBeInTheDocument();
  });

  it("marks HPP and profit metrics as operational estimates", () => {
    render(
      <div>
        <FinanceMetric amountMinor={1_250_000} variant="hpp-estimate" />
        <FinanceMetric amountMinor={2_100_000} variant="gross-profit" />
        <FinanceMetric amountMinor={1_450_000} variant="operating-profit" />
      </div>,
    );

    expect(screen.getByText("HPP estimate")).toBeVisible();
    expect(screen.getByText("Gross profit")).toBeVisible();
    expect(screen.getByText("Operating profit")).toBeVisible();
    expect(screen.getAllByText("Estimasi operasional")).toHaveLength(3);
  });

  it("renders unavailable data without inventing zero", () => {
    render(
      <FinanceMetric
        amountMinor={null}
        contextLabel="Inventory belum aktif"
        unavailableLabel="HPP belum tersedia"
        variant="hpp-estimate"
      />,
    );

    expect(screen.getByText("-")).toBeVisible();
    expect(screen.getByText("HPP belum tersedia")).toBeInTheDocument();
    expect(screen.queryByText("Rp0")).not.toBeInTheDocument();
  });

  it("rejects delta without comparison period", () => {
    expect(() =>
      render(
        <FinanceMetric
          amountMinor={100_000}
          delta={{ comparisonPeriodLabel: "", direction: "flat", label: "Stabil" }}
          variant="expense"
        />,
      ),
    ).toThrow(/periode pembanding/);
  });

  it("rejects sensitive finance payload fields before render", () => {
    expect(() =>
      render(
        <FinanceMetric
          {...({
            amountMinor: 100_000,
            customerPhone: "08123",
            variant: "revenue",
          } as Parameters<typeof FinanceMetric>[0] & { customerPhone: string })}
        />,
      ),
    ).toThrow(/customerPhone/);

    expect(() =>
      render(
        <FinanceMetric
          {...({
            amountMinor: 100_000,
            ledgerId: "ledger-internal",
            variant: "expense",
          } as Parameters<typeof FinanceMetric>[0] & { ledgerId: string })}
        />,
      ),
    ).toThrow(/ledgerId/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <FinanceMetric
          amountMinor={4_850_000}
          delta={{
            comparisonPeriodLabel: "vs minggu lalu",
            direction: "increase",
            label: "Naik 8%",
          }}
          tone="success"
          variant="revenue"
        />
        <FinanceMetric amountMinor={-50_000} tone="warning" variant="cash-variance" />
        <FinanceMetric amountMinor={null} variant="hpp-estimate" />
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
