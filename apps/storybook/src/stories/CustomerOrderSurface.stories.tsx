import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  CustomerOrderSurface,
  type CustomerOrderCartItem,
  type CustomerOrderSurfaceProps,
} from "@merchant/ui/customer-order-surface";

import { storyContractParameters } from "./story-contract";

const categories = [
  { count: 2, id: "coffee", label: "Kopi" },
  { count: 1, id: "food", label: "Makanan" },
  { count: 0, id: "dessert", label: "Dessert" },
] as const;

const products = [
  {
    categoryId: "coffee",
    description: "Espresso, susu segar, dan gula aren.",
    id: "product-safe-01",
    name: "Kopi susu signature",
    priceLabel: "Rp28.000",
  },
  {
    availability: "sold-out",
    categoryId: "coffee",
    description: "Cold brew siap botol harian.",
    id: "product-safe-02",
    name: "Cold brew",
    priceLabel: "Rp30.000",
  },
  {
    categoryId: "food",
    description: "Butter croissant dipanggang ulang.",
    id: "product-safe-03",
    name: "Croissant",
    priceLabel: "Rp24.000",
  },
] satisfies CustomerOrderSurfaceProps["products"];

const initialCart: readonly CustomerOrderCartItem[] = [
  {
    id: "cart-safe-01",
    lineTotalLabel: "Rp56.000",
    modifiers: ["Oat milk", "Less ice"],
    name: "Kopi susu signature",
    quantity: 2,
    unitPriceLabel: "Rp28.000",
  },
];

function StatefulCustomerOrderSurface() {
  const [activeCategoryId, setActiveCategoryId] = useState("coffee");
  const [cartItems, setCartItems] = useState<readonly CustomerOrderCartItem[]>(initialCart);
  const [submitted, setSubmitted] = useState(false);

  return (
    <CustomerOrderSurface
      activeCategoryId={activeCategoryId}
      cartItems={cartItems}
      categories={categories}
      merchantName="Kopi Senja"
      onAddProduct={() => setCartItems(initialCart)}
      onCartQuantityChange={(id, quantity) =>
        setCartItems((items) =>
          items.map((item) => (item.id === id ? { ...item, quantity } : item)),
        )
      }
      onRefreshStatus={() => setSubmitted(true)}
      onRemoveCartItem={(id) => setCartItems((items) => items.filter((item) => item.id !== id))}
      onSelectCategory={setActiveCategoryId}
      onSubmitOrder={() => setSubmitted(true)}
      orderStatus={
        submitted
          ? {
              etaLabel: "10 menit",
              itemCountLabel: "2 item",
              messageLabel: "Pesanan sedang disiapkan oleh dapur.",
              publicOrderLabel: "Order A-014",
              status: "preparing",
            }
          : { messageLabel: "Periksa cart sebelum mengirim pesanan.", status: "draft" }
      }
      outletName="Cabang Meruya"
      products={products.map((product) => ({
        ...product,
        selected: cartItems.some((item) => item.name === product.name),
      }))}
      serviceChargeLabel="Rp3.000"
      sourceLabel="QR meja"
      subtotalLabel={cartItems.length > 0 ? "Rp56.000" : "Rp0"}
      tableLabel="Meja 05"
      taxLabel={cartItems.length > 0 ? "Rp6.160" : "Rp0"}
      totalLabel={cartItems.length > 0 ? "Rp65.160" : "Rp0"}
    />
  );
}

const meta = {
  title: "Domain/Customer/Order Surface",
  component: CustomerOrderSurface,
  args: {
    activeCategoryId: "coffee",
    cartItems: initialCart,
    categories,
    merchantName: "Kopi Senja",
    outletName: "Cabang Meruya",
    products,
    subtotalLabel: "Rp56.000",
    tableLabel: "Meja 05",
    totalLabel: "Rp65.160",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomerOrderSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StatefulCustomerOrderSurface />,
};

export const EmptyDraft: Story = {
  render: () => (
    <CustomerOrderSurface
      activeCategoryId="dessert"
      cartItems={[]}
      categories={categories}
      merchantName="Kopi Senja"
      orderStatus={{ status: "draft" }}
      outletName="Cabang Meruya"
      products={products}
      subtotalLabel="Rp0"
      tableLabel="Meja 05"
      totalLabel="Rp0"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-customer-order-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <StatefulCustomerOrderSurface />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <StatefulCustomerOrderSurface />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <StatefulCustomerOrderSurface />,
};
