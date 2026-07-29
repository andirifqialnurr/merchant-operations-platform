import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FinanceReconciliationSummary } from "./finance-reconciliation-summary";

const reconciliationItems = [
  {
    actorLabel: "Nia Finance",
    differenceMinor: "0",
    expectedMinor: "2850000",
    id: "cash",
    label: "Tunai",
    notesLabel: "Kas cocok dengan hitungan shift.",
    recordedMinor: "2850000",
    statementLabel: "Laci kas",
    status: "matched",
  },
  {
    actorLabel: "Nia Finance",
    differenceMinor: "-15000",
    expectedMinor: "1225000",
    id: "qris",
    label: "QRIS merchant",
    notesLabel: "Menunggu bukti settle harian.",
    recordedMinor: "1210000",
    statementLabel: "Statement merchant",
    status: "difference",
  },
] as const;

const closedShift = {
  cashInMinor: "25000",
  cashOutMinor: "10000",
  cashSalesMinor: "2800000",
  closedAtLabel: "23 Jul 2026, 17.10",
  closedByLabel: "Ayu Pratama",
  countedCashMinor: "2865000",
  expectedCashMinor: "2865000",
  nonCashBreakdown: [{ amountMinor: "450000", id: "edc", label: "Kartu EDC" }],
  openedAtLabel: "23 Jul 2026, 08.00",
  openedByLabel: "Ayu Pratama",
  openingCashMinor: "50000",
  status: "closed",
  varianceMinor: "0",
  varianceVisible: true,
} as const;

describe("FinanceReconciliationSummary", () => {
  it("renders reconciliation values and a closed shift snapshot without inputs", () => {
    render(
      <FinanceReconciliationSummary
        items={reconciliationItems}
        periodLabel="Hari ini"
        shift={closedShift}
        sourceLabel="Outlet Sudirman"
        statusLabel="Manual check"
      />,
    );

    expect(screen.getByRole("region", { name: "Ringkasan rekonsiliasi Finance" })).toBeVisible();
    expect(screen.getByText("Tunai")).toBeVisible();
    expect(screen.getByText("QRIS merchant")).toBeVisible();
    expect(screen.getByText("Kartu EDC")).toBeVisible();
    expect(screen.getByText("-Rp15.000")).toBeVisible();
    expect(screen.getByText("Shift Summary")).toBeVisible();
    expect(screen.getByText("Kas fisik dihitung")).toBeVisible();
    expect(screen.getByText("Selisih kas")).toBeVisible();
    expect(screen.getAllByText("Nia Finance")).toHaveLength(2);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(/payment|customer|phone|ledger|journal|invoice|receipt|token|hpp|profit/i),
    ).not.toBeInTheDocument();
  });

  it("omits unavailable money rows and permission-filtered variance", () => {
    render(
      <FinanceReconciliationSummary
        items={[
          {
            expectedMinor: "100000",
            id: "transfer",
            label: "Transfer bank",
            recordedMinor: null,
            status: "pending",
          },
        ]}
        periodLabel="Minggu ini"
        shift={{ ...closedShift, varianceVisible: false }}
      />,
    );

    expect(screen.getByText("Transfer bank")).toBeVisible();
    expect(screen.getByText("Expected")).toBeVisible();
    expect(screen.queryByText("Recorded")).not.toBeInTheDocument();
    expect(screen.queryByText("Rp0")).not.toBeInTheDocument();
    expect(screen.queryByText("Selisih kas")).not.toBeInTheDocument();
  });

  it("rejects duplicate reconciliation ids", () => {
    expect(() =>
      render(
        <FinanceReconciliationSummary
          items={[reconciliationItems[0], { ...reconciliationItems[0], expectedMinor: "1" }]}
          periodLabel="Hari ini"
        />,
      ),
    ).toThrow(/id duplikat/);
  });

  it("rejects sensitive and future-scope payload before render", () => {
    expect(() =>
      render(
        <FinanceReconciliationSummary
          {...({
            items: reconciliationItems,
            ledgerId: "ledger-internal",
            periodLabel: "Hari ini",
          } as Parameters<typeof FinanceReconciliationSummary>[0] & { ledgerId: string })}
        />,
      ),
    ).toThrow(/ledgerId/);

    expect(() =>
      render(
        <FinanceReconciliationSummary
          {...({
            items: [{ ...reconciliationItems[0], paymentPayload: {} }],
            periodLabel: "Hari ini",
          } as unknown as Parameters<typeof FinanceReconciliationSummary>[0] & {
            items: Array<(typeof reconciliationItems)[number] & { paymentPayload: object }>;
          })}
        />,
      ),
    ).toThrow(/paymentPayload/);

    expect(() =>
      render(
        <FinanceReconciliationSummary
          {...({
            items: reconciliationItems,
            onApprove: () => undefined,
            periodLabel: "Hari ini",
          } as Parameters<typeof FinanceReconciliationSummary>[0] & { onApprove: () => void })}
        />,
      ),
    ).toThrow(/onApprove/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <FinanceReconciliationSummary
        items={reconciliationItems}
        periodLabel="Hari ini"
        shift={closedShift}
        sourceLabel="Outlet Sudirman"
        statusLabel="Manual check"
      />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
