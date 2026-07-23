import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CashKeypad, PaymentMethodTile, type PaymentMethodKind } from "@merchant/ui/pos-payment";

import { storyContractParameters } from "./story-contract";

function PaymentWorkspace() {
  const [method, setMethod] = useState<PaymentMethodKind>("cash");
  const [amount, setAmount] = useState("0");

  return (
    <div className="story-pos-payment-workspace">
      <fieldset className="story-pos-payment-methods">
        <legend className="text-heading-sm">Pilih metode pembayaran</legend>
        <div>
          <PaymentMethodTile
            kind="cash"
            label="Tunai"
            name="payment-workspace"
            onSelectedChange={() => setMethod("cash")}
            selected={method === "cash"}
            size="lg"
          />
          <PaymentMethodTile
            instruction="Scan kode QR merchant"
            kind="qris"
            label="QRIS merchant"
            name="payment-workspace"
            onSelectedChange={() => setMethod("qris")}
            selected={method === "qris"}
            size="lg"
          />
          <PaymentMethodTile
            instruction="Verifikasi rekening"
            kind="transfer"
            label="Transfer bank"
            name="payment-workspace"
            onSelectedChange={() => setMethod("transfer")}
            selected={method === "transfer"}
            size="lg"
          />
          <PaymentMethodTile
            availability="maintenance"
            instruction="Terminal sedang offline"
            kind="edc"
            label="Kartu EDC"
            name="payment-workspace"
            size="lg"
          />
          <PaymentMethodTile
            instruction="Gabungkan dua metode"
            kind="mixed"
            label="Pembayaran campuran"
            name="payment-workspace"
            onSelectedChange={() => setMethod("mixed")}
            selected={method === "mixed"}
            size="lg"
          />
        </div>
      </fieldset>

      {method === "cash" ? (
        <CashKeypad
          amountReceivedMinor={amount}
          onAmountReceivedChange={setAmount}
          totalMinor="75900"
        />
      ) : (
        <p className="story-contract-empty">
          Keypad tunai tidak digunakan untuk metode {method === "qris" ? "QRIS" : method}.
        </p>
      )}
    </div>
  );
}

const meta = {
  title: "Domain/POS/Payment",
  component: PaymentMethodTile,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PaymentMethodTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CheckoutWorkspace: Story = {
  args: { kind: "cash", label: "Tunai", name: "payment" },
  render: () => <PaymentWorkspace />,
};

export const TileSizesAndStates: Story = {
  args: { kind: "cash", label: "Tunai", name: "payment" },
  render: () => (
    <div className="story-pos-payment-tile-grid">
      <PaymentMethodTile kind="cash" label="Tunai" name="payment-md" selected />
      <PaymentMethodTile kind="qris" label="QRIS merchant" name="payment-md" />
      <PaymentMethodTile
        availability="unavailable"
        instruction="Belum dikonfigurasi"
        kind="transfer"
        label="Transfer bank"
        name="payment-md"
      />
      <PaymentMethodTile
        availability="maintenance"
        instruction="Terminal sedang offline"
        kind="edc"
        label="Kartu EDC"
        name="payment-lg"
        size="lg"
      />
      <PaymentMethodTile
        instruction="Gabungkan dua metode pembayaran"
        kind="mixed"
        label="Pembayaran campuran dengan label panjang"
        name="payment-lg"
        size="lg"
      />
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: { kind: "cash", label: "Tunai", name: "payment" },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <PaymentMethodTile kind="cash" label="Tunai" name="theme-light" selected />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <PaymentMethodTile kind="cash" label="Tunai" name="theme-dark" selected />
      </section>
    </div>
  ),
};

export const MobileReflow: Story = {
  args: { kind: "cash", label: "Tunai", name: "payment" },
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <PaymentWorkspace />,
};
