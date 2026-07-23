import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CartItem, CartSummary } from "./pos-cart";

describe("CartItem", () => {
  it("updates quantity, removes an item, and expands long modifier details", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <CartItem
        lineTotalLabel="Rp70.000"
        modifiers={["Large", "Gula sedikit", "Extra shot", "Coffee jelly"]}
        name="Es kopi susu gula aren"
        note="Es sedikit"
        onQuantityChange={onQuantityChange}
        onRemove={onRemove}
        quantity={2}
        unitPriceLabel="Rp35.000"
      />,
    );

    expect(screen.getByText("Extra shot")).toBeVisible();
    expect(screen.queryByText("Coffee jelly")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lihat detail (+1)" }));
    expect(screen.getByText("Coffee jelly")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tutup detail" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Tambah Es kopi susu gula aren" }));
    expect(onQuantityChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole("button", { name: "Hapus Es kopi susu gula aren" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("keeps the receipt variant read-only while preserving quantity and totals", () => {
    render(
      <CartItem
        lineTotalLabel="Rp48.000"
        modifiers={["Regular", "Normal"]}
        name="Es kopi susu"
        quantity={2}
        unitPriceLabel="Rp24.000"
        variant="receipt"
      />,
    );

    expect(screen.getByLabelText("Jumlah 2")).toHaveTextContent("2×");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Rp48.000")).toBeVisible();
  });
});

describe("CartSummary", () => {
  it("preserves the financial row order and omits rows that do not apply", () => {
    render(
      <CartSummary
        amountDueLabel="Rp44.400"
        discountLabel="-Rp10.000"
        paymentRecordedLabel="Rp20.000"
        serviceChargeLabel="Rp4.000"
        subtotalLabel="Rp60.000"
        taxLabel="Rp6.400"
        totalLabel="Rp64.400"
      />,
    );

    const summary = screen.getByRole("region", { name: "Ringkasan keranjang" });
    const terms = within(summary)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual([
      "Subtotal",
      "Diskon",
      "Pajak",
      "Service charge",
      "Total",
      "Pembayaran tercatat",
      "Sisa tagihan",
    ]);
    expect(within(summary).queryByText("Pembulatan")).not.toBeInTheDocument();
  });

  it("passes an axe smoke test for interactive and receipt cart content", async () => {
    const { container } = render(
      <main>
        <CartItem
          lineTotalLabel="Rp35.000"
          modifiers={["Large", "Gula sedikit", "Extra shot", "Coffee jelly"]}
          name="Es kopi susu gula aren"
          onQuantityChange={() => undefined}
          onRemove={() => undefined}
          quantity={1}
          unitPriceLabel="Rp35.000"
        />
        <CartSummary subtotalLabel="Rp35.000" totalLabel="Rp35.000" />
      </main>,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
