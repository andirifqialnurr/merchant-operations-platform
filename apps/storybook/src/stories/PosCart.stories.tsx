import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  CartItem,
  type CartItemLabels,
  CartSummary,
  type CartSummaryLabels,
} from "@merchant/ui/pos-cart";

function cartItemLabels(name: string): CartItemLabels {
  return {
    collapseDetails: "Tutup detail",
    decrease: `Kurangi ${name}`,
    expandDetails: (hiddenCount) => `Lihat detail (+${hiddenCount})`,
    increase: `Tambah ${name}`,
    lineTotal: "Total item",
    modifiers: "Modifier",
    note: "Catatan",
    quantity: "Jumlah",
    remove: `Hapus ${name}`,
    unitPrice: "Harga satuan",
  };
}

const cartSummaryLabels: CartSummaryLabels = {
  amountDue: "Sisa tagihan",
  discount: "Diskon",
  paymentRecorded: "Pembayaran tercatat",
  rounding: "Pembulatan",
  serviceCharge: "Service charge",
  subtotal: "Subtotal",
  tax: "Pajak",
  total: "Total",
};

import { storyContractParameters } from "./story-contract";

const modifiers = [
  "Ukuran large",
  "Gula lebih sedikit",
  "Extra espresso shot",
  "Coffee jelly",
  "Oat milk dengan nama modifier panjang untuk menguji reflow pada area sempit",
] as const;

function InteractiveCartItem({ compact = false }: { compact?: boolean }) {
  const [quantity, setQuantity] = useState(2);
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return <p className="story-contract-empty">Item sudah dihapus dari keranjang.</p>;
  }

  return (
    <CartItem
      labels={cartItemLabels("Es kopi susu gula aren signature dengan nama produk yang panjang")}
      lineTotalLabel={quantity === 2 ? "Rp70.000" : "Rp105.000"}
      modifiers={modifiers}
      name="Es kopi susu gula aren signature dengan nama produk yang panjang"
      note="Es sedikit, tanpa sedotan, pisahkan minuman dari makanan panas."
      onQuantityChange={setQuantity}
      onRemove={() => setRemoved(true)}
      quantity={quantity}
      unitPriceLabel="Rp35.000"
      variant={compact ? "compact" : "default"}
    />
  );
}

const meta = {
  title: "Domain/POS/Cart",
  component: CartItem,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CartItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ItemVariants: Story = {
  args: {
    labels: cartItemLabels("Es kopi susu gula aren"),
    lineTotalLabel: "Rp70.000",
    name: "Es kopi susu gula aren",
    quantity: 2,
    unitPriceLabel: "Rp35.000",
  },
  render: () => (
    <div className="story-pos-cart-variants">
      <section>
        <h2 className="text-heading-sm">Compact · POS sidebar</h2>
        <InteractiveCartItem compact />
      </section>
      <section>
        <h2 className="text-heading-sm">Default · cart page</h2>
        <InteractiveCartItem />
      </section>
      <section>
        <h2 className="text-heading-sm">Receipt · read-only</h2>
        <CartItem
          labels={cartItemLabels("Es kopi susu gula aren signature")}
          lineTotalLabel="Rp70.000"
          modifiers={modifiers.slice(0, 3)}
          name="Es kopi susu gula aren signature"
          note="Es sedikit"
          quantity={2}
          unitPriceLabel="Rp35.000"
          variant="receipt"
        />
      </section>
    </div>
  ),
};

export const SummaryBreakdown: Story = {
  args: {
    labels: cartItemLabels("Es kopi susu gula aren"),
    lineTotalLabel: "Rp70.000",
    name: "Es kopi susu gula aren",
    quantity: 2,
    unitPriceLabel: "Rp35.000",
  },
  render: () => (
    <div className="story-pos-cart-summary-grid">
      <section>
        <h2 className="text-heading-sm">Checkout berjalan</h2>
        <CartSummary
          ariaLabel="Ringkasan keranjang"
          labels={cartSummaryLabels}
          amountDueLabel="Rp44.400"
          discountLabel="-Rp10.000"
          paymentRecordedLabel="Rp20.000"
          serviceChargeLabel="Rp4.000"
          subtotalLabel="Rp60.000"
          taxLabel="Rp6.400"
          totalLabel="Rp64.400"
        />
      </section>
      <section>
        <h2 className="text-heading-sm">Baris minimum</h2>
        <CartSummary
          ariaLabel="Ringkasan keranjang"
          labels={cartSummaryLabels}
          subtotalLabel="Rp35.000"
          totalLabel="Rp35.000"
        />
      </section>
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: {
    labels: cartItemLabels("Es kopi susu gula aren"),
    lineTotalLabel: "Rp70.000",
    name: "Es kopi susu gula aren",
    quantity: 2,
    unitPriceLabel: "Rp35.000",
  },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <CartItem
          labels={cartItemLabels("Es kopi susu gula aren")}
          lineTotalLabel="Rp35.000"
          modifiers={modifiers.slice(0, 2)}
          name="Es kopi susu gula aren"
          onQuantityChange={() => undefined}
          onRemove={() => undefined}
          quantity={1}
          unitPriceLabel="Rp35.000"
          variant="compact"
        />
        <CartSummary
          ariaLabel="Ringkasan keranjang"
          labels={cartSummaryLabels}
          subtotalLabel="Rp35.000"
          totalLabel="Rp35.000"
        />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <CartItem
          labels={cartItemLabels("Es kopi susu gula aren")}
          lineTotalLabel="Rp35.000"
          modifiers={modifiers.slice(0, 2)}
          name="Es kopi susu gula aren"
          onQuantityChange={() => undefined}
          onRemove={() => undefined}
          quantity={1}
          unitPriceLabel="Rp35.000"
          variant="compact"
        />
        <CartSummary
          ariaLabel="Ringkasan keranjang"
          labels={cartSummaryLabels}
          subtotalLabel="Rp35.000"
          totalLabel="Rp35.000"
        />
      </section>
    </div>
  ),
};

export const MobileReflow: Story = {
  args: {
    labels: cartItemLabels("Es kopi susu gula aren"),
    lineTotalLabel: "Rp70.000",
    name: "Es kopi susu gula aren",
    quantity: 2,
    unitPriceLabel: "Rp35.000",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: () => (
    <div className="story-pos-cart-mobile">
      <InteractiveCartItem />
      <CartSummary
        ariaLabel="Ringkasan keranjang"
        labels={cartSummaryLabels}
        discountLabel="-Rp5.000"
        serviceChargeLabel="Rp4.000"
        subtotalLabel="Rp70.000"
        taxLabel="Rp6.900"
        totalLabel="Rp75.900"
      />
    </div>
  ),
};
