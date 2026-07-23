import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { buildCashPresets, CashKeypad, PaymentMethodTile } from "./pos-payment";

function CashKeypadHarness() {
  const [amount, setAmount] = useState("0");
  return (
    <CashKeypad
      amountReceivedMinor={amount}
      onAmountReceivedChange={setAmount}
      totalMinor="75900"
    />
  );
}

describe("PaymentMethodTile", () => {
  it("selects an available radio tile and preserves unavailable context", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();

    render(
      <fieldset>
        <legend>Metode pembayaran</legend>
        <PaymentMethodTile
          kind="cash"
          label="Tunai"
          name="payment"
          onSelectedChange={onSelectedChange}
        />
        <PaymentMethodTile
          availability="maintenance"
          instruction="Gunakan metode lain"
          kind="edc"
          label="Kartu EDC"
          name="payment"
        />
      </fieldset>,
    );

    await user.click(screen.getByRole("radio", { name: /Tunai/ }));
    expect(onSelectedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("radio", { name: /Kartu EDC/ })).toBeDisabled();
    expect(screen.getByText("Sedang gangguan")).toBeVisible();
    expect(screen.getByText("Gunakan metode lain")).toBeVisible();
  });
});

describe("CashKeypad", () => {
  it("builds transaction-aware presets without duplicate values", () => {
    expect(buildCashPresets("75900")).toEqual(["75900", "80000", "100000"]);
    expect(buildCashPresets(100_000)).toEqual(["100000"]);
  });

  it("enters, removes, and clears a cash amount", async () => {
    const user = userEvent.setup();
    render(<CashKeypadHarness />);

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("Rp123")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Hapus satu digit" }));
    expect(screen.getByText("Rp12")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Bersihkan nominal" }));
    expect(screen.getAllByText("Rp0")).toHaveLength(2);
  });

  it("applies a preset and exposes the resulting change", async () => {
    const user = userEvent.setup();
    render(<CashKeypadHarness />);

    await user.click(screen.getByRole("button", { name: "Rp80.000" }));
    const amountReceivedRow = screen.getByText("Diterima").parentElement;
    expect(amountReceivedRow).not.toBeNull();
    expect(within(amountReceivedRow!).getByText("Rp80.000")).toBeVisible();
    expect(screen.getByText("Rp4.100")).toBeVisible();
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <main>
        <fieldset>
          <legend>Metode pembayaran</legend>
          <PaymentMethodTile kind="cash" label="Tunai" name="payment-axe" selected />
          <PaymentMethodTile kind="qris" label="QRIS merchant" name="payment-axe" />
        </fieldset>
        <CashKeypad
          amountReceivedMinor="80000"
          onAmountReceivedChange={() => undefined}
          totalMinor="75900"
        />
      </main>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
