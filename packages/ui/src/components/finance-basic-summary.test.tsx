import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FinanceBasicSummary } from "./finance-basic-summary";

const summaryEntries = [
  {
    amountMinor: "4850000",
    contextLabel: "Bill valid hari ini",
    countLabel: "42 transaksi",
    id: "sales",
    kind: "sales",
    statusLabel: "Otomatis dari transaksi",
  },
  {
    amountMinor: "925000",
    contextLabel: "Operasional manual",
    countLabel: "6 dokumen",
    id: "expense",
    kind: "expense",
  },
  {
    amountMinor: "300000",
    contextLabel: "Pemasukan non-penjualan",
    countLabel: "2 catatan",
    id: "other-income",
    kind: "other-income",
  },
  {
    amountMinor: "4225000",
    contextLabel: "Kas operasional berjalan",
    countLabel: "Saldo akhir",
    id: "cashbook",
    kind: "cashbook",
  },
] as const;

describe("FinanceBasicSummary", () => {
  it("renders sales, expense, other income, and cashbook as read-only display", () => {
    render(
      <FinanceBasicSummary
        cashbook={{
          cashInMinor: "5150000",
          cashOutMinor: "900000",
          closingBalanceMinor: "4250000",
          openingBalanceMinor: "0",
        }}
        entries={summaryEntries}
        periodLabel="Hari ini"
        sourceLabel="Outlet Sudirman"
        statusLabel="Tersinkron"
      />,
    );

    expect(screen.getByRole("region", { name: "Ringkasan Finance Basic" })).toBeVisible();
    expect(screen.getByText("Sales")).toBeVisible();
    expect(screen.getByText("Expense")).toBeVisible();
    expect(screen.getByText("Other income")).toBeVisible();
    expect(screen.getByText("Cashbook")).toBeVisible();
    expect(screen.getByText("Rp4.850.000")).toBeVisible();
    expect(screen.getByText("Rp925.000")).toBeVisible();
    expect(screen.getByText("Rp300.000")).toBeVisible();
    expect(screen.getByText("Rp4.225.000")).toBeVisible();
    expect(screen.getByText("Rp4.250.000")).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(/payment|customer|phone|ledger|journal|invoice/i),
    ).not.toBeInTheDocument();
  });

  it("omits unavailable flow and cashbook rows instead of inventing zero", () => {
    render(
      <FinanceBasicSummary
        cashbook={{ cashInMinor: null, closingBalanceMinor: "125000" }}
        entries={[
          ...summaryEntries.slice(0, 2),
          {
            amountMinor: null,
            contextLabel: "Belum ada pemasukan lain",
            id: "other-income",
            kind: "other-income",
          },
        ]}
        periodLabel="Minggu ini"
      />,
    );

    expect(screen.queryByText("Other income")).not.toBeInTheDocument();
    expect(screen.queryByText("Kas masuk")).not.toBeInTheDocument();
    expect(screen.getByText("Saldo akhir")).toBeVisible();
    expect(screen.queryByText("Rp0")).not.toBeInTheDocument();
  });

  it("rejects duplicate finance flow locations", () => {
    expect(() =>
      render(
        <FinanceBasicSummary
          entries={[
            summaryEntries[0],
            { ...summaryEntries[0], amountMinor: "100000", id: "sales-copy" },
          ]}
          periodLabel="Hari ini"
        />,
      ),
    ).toThrow(/satu lokasi utama/);
  });

  it("rejects sensitive and future-scope finance payload fields before render", () => {
    expect(() =>
      render(
        <FinanceBasicSummary
          {...({
            entries: summaryEntries,
            ledgerId: "ledger-internal",
            periodLabel: "Hari ini",
          } as Parameters<typeof FinanceBasicSummary>[0] & { ledgerId: string })}
        />,
      ),
    ).toThrow(/ledgerId/);

    expect(() =>
      render(
        <FinanceBasicSummary
          {...({
            entries: [{ ...summaryEntries[0], paymentBreakdown: [] }],
            periodLabel: "Hari ini",
          } as unknown as Parameters<typeof FinanceBasicSummary>[0] & {
            entries: Array<(typeof summaryEntries)[number] & { paymentBreakdown: unknown[] }>;
          })}
        />,
      ),
    ).toThrow(/paymentBreakdown/);

    expect(() =>
      render(
        <FinanceBasicSummary
          {...({
            entries: summaryEntries,
            grossProfitMinor: "2000000",
            periodLabel: "Hari ini",
          } as Parameters<typeof FinanceBasicSummary>[0] & { grossProfitMinor: string })}
        />,
      ),
    ).toThrow(/grossProfitMinor/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <FinanceBasicSummary
        cashbook={{
          cashInMinor: "5150000",
          cashOutMinor: "900000",
          closingBalanceMinor: "4250000",
          openingBalanceMinor: "0",
        }}
        entries={summaryEntries}
        periodLabel="Hari ini"
        sourceLabel="Outlet Sudirman"
        statusLabel="Tersinkron"
      />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
