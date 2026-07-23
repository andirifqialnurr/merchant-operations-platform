import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@merchant/ui/button";
import { MoneyDisplay, formatMoneyMinor } from "@merchant/ui/money-display";
import { CartItem, CartSummary } from "@merchant/ui/pos-cart";
import { CategoryRail, ProductTile } from "@merchant/ui/pos-catalog";
import {
  CashKeypad,
  PaymentConfirmationPanel,
  PaymentMethodTile,
  type PaymentMethodKind,
} from "@merchant/ui/pos-payment";

import { storyContractParameters } from "./story-contract";

type FlowStage = "order" | "payment" | "verifying" | "paid";
type FlowPaymentMethod = Extract<PaymentMethodKind, "cash" | "qris">;

type FlowProduct = {
  availability?: "available" | "sold-out";
  categoryId: "coffee" | "food";
  id: string;
  name: string;
  priceMinor: number;
};

const products: readonly FlowProduct[] = [
  { categoryId: "coffee", id: "kopi-susu", name: "Kopi Susu Gula Aren", priceMinor: 28_000 },
  { categoryId: "coffee", id: "americano", name: "Americano", priceMinor: 23_000 },
  { categoryId: "food", id: "croissant", name: "Butter Croissant", priceMinor: 24_000 },
  {
    availability: "sold-out",
    categoryId: "food",
    id: "sandwich",
    name: "Chicken Sandwich",
    priceMinor: 32_000,
  },
];

const categories = [
  { count: 2, id: "coffee", label: "Kopi" },
  { count: 2, id: "food", label: "Makanan" },
] as const;

const orderNumber = "POS-0723-0142";
const orderTimeLabel = "23 Jul 2026, 13.20";

function ManualPosFlow() {
  const [stage, setStage] = useState<FlowStage>("order");
  const [categoryId, setCategoryId] = useState<(typeof categories)[number]["id"]>("coffee");
  const [quantities, setQuantities] = useState<Record<string, number>>({ "kopi-susu": 1 });
  const [method, setMethod] = useState<FlowPaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("0");

  const cartLines = useMemo(
    () =>
      products
        .map((product) => ({ ...product, quantity: quantities[product.id] ?? 0 }))
        .filter((product) => product.quantity > 0),
    [quantities],
  );
  const subtotalMinor = cartLines.reduce(
    (total, product) => total + product.priceMinor * product.quantity,
    0,
  );
  const serviceChargeMinor = Math.round(subtotalMinor * 0.1);
  const totalMinor = subtotalMinor + serviceChargeMinor;
  const paymentMethodLabel = method === "cash" ? "Tunai" : "QRIS merchant";

  function setQuantity(productId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [productId]: quantity }));
  }

  function removeProduct(productId: string) {
    setQuantities((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function resetFlow() {
    setStage("order");
    setCategoryId("coffee");
    setQuantities({ "kopi-susu": 1 });
    setMethod("cash");
    setCashReceived("0");
  }

  if (stage === "verifying" || stage === "paid") {
    return (
      <main className="story-pos-manual-flow">
        <header className="story-pos-manual-header">
          <div>
            <p>Order {orderNumber}</p>
            <h1>Pembayaran manual</h1>
          </div>
        </header>

        <div className="story-pos-manual-confirmation">
          <PaymentConfirmationPanel
            amountMinor={totalMinor}
            methodLabel={paymentMethodLabel}
            orderTimeLabel={orderTimeLabel}
            status={stage === "paid" ? "paid" : "verifying"}
            {...(method === "qris" ? { reference: "QR-0142" } : {})}
            {...(stage === "verifying"
              ? {
                  onConfirm: () => setStage("paid"),
                  verifierInstruction:
                    "Cocokkan nominal dan notifikasi pada akun merchant sebelum konfirmasi.",
                }
              : {})}
          />
          {stage === "paid" ? (
            <Button onClick={resetFlow} size="lg" type="button" variant="secondary">
              Mulai pesanan baru
            </Button>
          ) : null}
        </div>
      </main>
    );
  }

  if (stage === "payment") {
    const cashSufficient = BigInt(cashReceived) >= BigInt(totalMinor);

    return (
      <main className="story-pos-manual-flow">
        <header className="story-pos-manual-header">
          <Button onClick={() => setStage("order")} size="sm" type="button" variant="ghost">
            Kembali ke keranjang
          </Button>
          <div>
            <p>Order {orderNumber}</p>
            <h1>Pilih pembayaran</h1>
          </div>
        </header>

        <section aria-label="Pembayaran order" className="story-pos-manual-payment">
          <div className="story-pos-manual-total">
            <span>Total tagihan</span>
            <MoneyDisplay amountMinor={totalMinor} variant="total" />
          </div>

          <fieldset className="story-pos-manual-methods">
            <legend>Pilih metode pembayaran</legend>
            <div>
              <PaymentMethodTile
                kind="cash"
                label="Tunai"
                name="manual-payment"
                onSelectedChange={() => setMethod("cash")}
                selected={method === "cash"}
                size="lg"
              />
              <PaymentMethodTile
                instruction="Verifikasi notifikasi merchant"
                kind="qris"
                label="QRIS merchant"
                name="manual-payment"
                onSelectedChange={() => setMethod("qris")}
                selected={method === "qris"}
                size="lg"
              />
            </div>
          </fieldset>

          {method === "cash" ? (
            <CashKeypad
              amountReceivedMinor={cashReceived}
              onAmountReceivedChange={setCashReceived}
              totalMinor={totalMinor}
            />
          ) : null}

          <Button
            disabled={method === "cash" && !cashSufficient}
            onClick={() => setStage(method === "cash" ? "paid" : "verifying")}
            size="lg"
            type="button"
          >
            {method === "cash" ? "Konfirmasi pembayaran tunai" : "Lanjutkan verifikasi"}
          </Button>
        </section>
      </main>
    );
  }

  const visibleProducts = products.filter((product) => product.categoryId === categoryId);

  return (
    <main className="story-pos-manual-flow">
      <header className="story-pos-manual-header">
        <div>
          <p>POS · Takeaway</p>
          <h1>Pesanan baru</h1>
        </div>
      </header>

      <div className="story-pos-manual-order">
        <section aria-labelledby="manual-catalog-title" className="story-pos-manual-catalog">
          <h2 id="manual-catalog-title">Pilih produk</h2>
          <div className="story-pos-manual-catalog-body">
            <CategoryRail
              activeId={categoryId}
              categories={categories}
              onSelect={(next) => setCategoryId(next as typeof categoryId)}
              orientation="vertical"
            />
            <div className="story-pos-manual-products">
              {visibleProducts.map((product) => (
                <ProductTile
                  availability={product.availability ?? "available"}
                  key={product.id}
                  name={product.name}
                  onClick={() => setQuantity(product.id, (quantities[product.id] ?? 0) + 1)}
                  priceLabel={formatMoneyMinor(product.priceMinor)}
                  selected={Boolean(quantities[product.id])}
                  size="md"
                  variant="compact"
                />
              ))}
            </div>
          </div>
        </section>

        <aside aria-labelledby="manual-cart-title" className="story-pos-manual-cart">
          <h2 id="manual-cart-title">Keranjang</h2>
          {cartLines.length > 0 ? (
            <>
              <div className="story-pos-manual-cart-lines">
                {cartLines.map((product) => (
                  <CartItem
                    key={product.id}
                    lineTotalLabel={formatMoneyMinor(product.priceMinor * product.quantity)}
                    name={product.name}
                    onQuantityChange={(quantity) => setQuantity(product.id, quantity)}
                    onRemove={() => removeProduct(product.id)}
                    quantity={product.quantity}
                    unitPriceLabel={formatMoneyMinor(product.priceMinor)}
                    variant="compact"
                  />
                ))}
              </div>
              <CartSummary
                serviceChargeLabel={
                  <MoneyDisplay amountMinor={serviceChargeMinor} variant="summary" />
                }
                subtotalLabel={<MoneyDisplay amountMinor={subtotalMinor} variant="summary" />}
                totalLabel={<MoneyDisplay amountMinor={totalMinor} variant="summary" />}
              />
            </>
          ) : (
            <p className="story-contract-empty">Pilih produk untuk memulai pesanan.</p>
          )}
          <Button
            disabled={cartLines.length === 0}
            fullWidth
            onClick={() => setStage("payment")}
            size="lg"
            type="button"
          >
            Lanjut ke pembayaran
          </Button>
        </aside>
      </div>
    </main>
  );
}

const meta = {
  title: "Domain/POS/Manual Flow",
  component: PaymentConfirmationPanel,
  parameters: {
    ...storyContractParameters,
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PaymentConfirmationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CashierOrderToPayment: Story = {
  args: {
    amountMinor: "30800",
    methodLabel: "Tunai",
    orderTimeLabel,
    status: "unpaid",
  },
  render: () => <ManualPosFlow />,
};

export const MobileCashierFlow: Story = {
  args: {
    amountMinor: "30800",
    methodLabel: "Tunai",
    orderTimeLabel,
    status: "unpaid",
  },
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <ManualPosFlow />,
};
