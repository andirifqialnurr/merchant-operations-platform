import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Receipt } from "./receipt";

const props = {
  ariaLabel: "Struk",
  footer: "Terima kasih",
  lines: [
    { amount: "Rp40.000", key: "1", name: "Kentang Goreng", quantity: "2×" },
    {
      amount: "Rp82.000",
      detail: "Dingin · Large",
      key: "2",
      name: "Caffe Latte",
      quantity: "2×",
    },
  ],
  meta: [
    { label: "No. penjualan", value: "#12" },
    { label: "Kasir", value: "Ayu" },
  ],
  payment: [
    { label: "Tunai", value: "Rp150.000" },
    { emphasis: true, label: "Kembalian", value: "Rp28.000" },
  ],
  subtitle: "Catalog Local",
  title: "Kopi Lokal Pusat",
  totals: [{ emphasis: true, label: "Total", value: "Rp122.000" }],
} as const;

describe("Receipt", () => {
  it("prints the caller's rows and lines in order", () => {
    render(<Receipt {...props} />);
    const receipt = screen.getByRole("region", { name: "Struk" });

    expect(within(receipt).getByText("Kopi Lokal Pusat")).toBeVisible();
    expect(within(receipt).getByText("2× Caffe Latte")).toBeVisible();
    expect(within(receipt).getByText("Dingin · Large")).toBeVisible();
    expect(within(receipt).getByText("Rp122.000")).toBeVisible();
    expect(within(receipt).getByText("Terima kasih")).toBeVisible();
    expect(within(receipt).queryByText("SALINAN")).not.toBeInTheDocument();
    expect(receipt).toHaveClass("ui-receipt--80mm");
  });

  it("marks a reprint and follows the chosen paper", () => {
    render(<Receipt {...props} copyLabel="SALINAN" paper="58mm" />);

    expect(screen.getByText("SALINAN")).toBeVisible();
    expect(screen.getByRole("region", { name: "Struk" })).toHaveClass("ui-receipt--58mm");
  });

  it("keeps labeled order/payment groups separate and pending lines unpriced", async () => {
    const { container } = render(
      <Receipt
        {...props}
        lines={[]}
        payment={[]}
        documentLabel="Tagihan · Menunggu tinjauan"
        lineGroups={[
          {
            key: "order-1",
            title: "Pesanan #1",
            lines: [{ key: "line-1", name: "Kopi", quantity: "1×", amount: "Rp50.000" }],
          },
          {
            key: "order-2",
            title: "Tinjau · Pesanan #2",
            detail: "Tanpa gula",
            lines: [{ key: "line-2", name: "Teh", quantity: "1×" }],
          },
        ]}
        paymentGroups={[
          { key: "payment-1", title: "Tunai", rows: [{ label: "Pembayaran", value: "Rp50.000" }] },
        ]}
      />,
    );
    const receipt = screen.getByRole("region", { name: "Struk" });
    expect(within(receipt).getAllByText("Tunai")).toHaveLength(1);
    expect(within(receipt).getAllByText("Tagihan · Menunggu tinjauan")).toHaveLength(1);
    const pending = within(receipt).getByText("Tinjau · Pesanan #2").closest(".ui-receipt__group")!;
    expect(within(pending as HTMLElement).getByText("1× Teh")).toBeVisible();
    expect(pending.querySelectorAll(".ui-receipt__line > span")).toHaveLength(1);
    expect(pending.querySelectorAll("dl")).toHaveLength(0);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <main>
        <Receipt {...props} />
      </main>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
