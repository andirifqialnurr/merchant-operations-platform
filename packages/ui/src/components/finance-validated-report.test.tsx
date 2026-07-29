import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FinanceValidatedReport } from "./finance-validated-report";

const reportProps = {
  metrics: [
    {
      amountMinor: "4850000",
      categoryLabel: "Sales",
      id: "metric-sales",
      kind: "sales",
      label: "Sales",
      noteLabel: "Dari transaksi valid",
      previousAmountMinor: "4200000",
      validation: "validated",
      validationLabel: "Tervalidasi",
    },
    {
      amountMinor: "1550000",
      categoryLabel: "Profit estimate",
      id: "metric-hpp",
      kind: "hpp-estimate",
      label: "HPP estimate",
      noteLabel: "Recipe aktif",
      previousAmountMinor: "1400000",
      validation: "validated",
    },
    {
      amountMinor: "2675000",
      categoryLabel: "Profit estimate",
      id: "metric-operating-profit",
      kind: "operating-profit",
      label: "Operating profit",
      noteLabel: "Gross profit dikurangi expense",
      previousAmountMinor: "2300000",
      validation: "validated",
    },
  ],
  periodLabel: "Hari ini",
  sourceLabel: "Outlet Sudirman",
  statusLabel: "Validated only",
  trendPoints: [
    {
      id: "trend-sen",
      label: "Sen",
      values: {
        "hpp-estimate": "1200000",
        "operating-profit": "2100000",
        sales: "4100000",
      },
    },
    {
      id: "trend-sel",
      label: "Sel",
      values: {
        "hpp-estimate": "1550000",
        "operating-profit": "2675000",
        sales: "4850000",
      },
    },
  ],
} as const;

describe("FinanceValidatedReport", () => {
  it("renders validated Finance metrics as a read-only table and chart summary", () => {
    render(<FinanceValidatedReport {...reportProps} />);

    expect(screen.getByRole("region", { name: "Report Finance tervalidasi" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Trend metrik tervalidasi" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Tabel metrik tervalidasi" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Metrik" })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: /Sales/ })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: /HPP estimate/ })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: /Operating profit/ })).toBeVisible();
    expect(screen.getByText("Rp4.850.000")).toBeVisible();
    expect(screen.getByText("Rp1.550.000")).toBeVisible();
    expect(screen.getByText("Rp2.675.000")).toBeVisible();
    expect(screen.getByText("3 dari 3 metrik tervalidasi tampil pada trend.")).toBeVisible();
    expect(screen.getAllByText("Tervalidasi")).toHaveLength(3);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(/payment|customer|phone|ledger|journal|invoice|receipt|token|raw/i),
    ).not.toBeInTheDocument();
  });

  it("does not invent chart series when trend values are unavailable", () => {
    render(
      <FinanceValidatedReport
        metrics={reportProps.metrics}
        periodLabel="Minggu ini"
        trendPoints={[
          {
            id: "trend-empty",
            label: "Minggu ini",
            values: { sales: null },
          },
        ]}
      />,
    );

    expect(screen.getByText("Data chart belum tersedia")).toBeInTheDocument();
    expect(screen.getByText("Belum ada titik trend tervalidasi untuk chart.")).toBeVisible();
    expect(screen.queryByText("Rp0")).not.toBeInTheDocument();
  });

  it("rejects unvalidated metrics instead of hiding them in the report", () => {
    expect(() =>
      render(
        <FinanceValidatedReport
          {...({
            ...reportProps,
            metrics: [
              ...reportProps.metrics,
              {
                amountMinor: "500000",
                id: "metric-unvalidated",
                kind: "expense",
                label: "Draft expense",
                validation: "pending",
              },
            ],
          } as Parameters<typeof FinanceValidatedReport>[0])}
        />,
      ),
    ).toThrow(/tervalidasi/);
  });

  it("rejects sensitive, raw, action, and external chart config props", () => {
    expect(() =>
      render(
        <FinanceValidatedReport
          {...({
            ...reportProps,
            ledgerId: "ledger-internal",
          } as Parameters<typeof FinanceValidatedReport>[0] & { ledgerId: string })}
        />,
      ),
    ).toThrow(/ledgerId/);

    expect(() =>
      render(
        <FinanceValidatedReport
          {...({
            ...reportProps,
            metrics: [{ ...reportProps.metrics[0], paymentPayload: {} }],
          } as unknown as Parameters<typeof FinanceValidatedReport>[0] & {
            metrics: Array<(typeof reportProps.metrics)[number] & { paymentPayload?: object }>;
          })}
        />,
      ),
    ).toThrow(/paymentPayload/);

    expect(() =>
      render(
        <FinanceValidatedReport
          {...({
            ...reportProps,
            chartOptions: { toolbar: true },
          } as Parameters<typeof FinanceValidatedReport>[0] & { chartOptions: object })}
        />,
      ),
    ).toThrow(/chartOptions/);

    expect(() =>
      render(
        <FinanceValidatedReport
          {...({
            ...reportProps,
            onExport: () => undefined,
          } as Parameters<typeof FinanceValidatedReport>[0] & { onExport: () => void })}
        />,
      ),
    ).toThrow(/onExport/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<FinanceValidatedReport {...reportProps} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
