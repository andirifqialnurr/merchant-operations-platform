import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CustomerOrderSurface, type CustomerOrderSurfaceProps } from "./customer-order-surface";

const orderProps: CustomerOrderSurfaceProps = {
  activeCategoryId: "coffee",
  cartItems: [
    {
      id: "cart-safe-01",
      lineTotalLabel: "Rp56.000",
      modifiers: ["Oat milk", "Less ice"],
      name: "Kopi susu signature",
      quantity: 2,
      unitPriceLabel: "Rp28.000",
    },
  ],
  categories: [
    { count: 2, id: "coffee", label: "Kopi" },
    { count: 1, id: "food", label: "Makanan" },
  ],
  merchantName: "Kopi Senja",
  orderStatus: {
    etaLabel: "10 menit",
    itemCountLabel: "2 item",
    messageLabel: "Pesanan sedang disiapkan oleh dapur.",
    publicOrderLabel: "Order A-014",
    status: "preparing",
  },
  outletName: "Cabang Meruya",
  products: [
    {
      categoryId: "coffee",
      description: "Espresso, susu segar, dan gula aren.",
      id: "product-safe-01",
      name: "Kopi susu signature",
      priceLabel: "Rp28.000",
      selected: true,
    },
    {
      availability: "sold-out",
      categoryId: "coffee",
      id: "product-safe-02",
      name: "Cold brew",
      priceLabel: "Rp30.000",
    },
    {
      categoryId: "food",
      id: "product-safe-03",
      name: "Croissant",
      priceLabel: "Rp24.000",
    },
  ],
  serviceChargeLabel: "Rp3.000",
  sourceLabel: "QR meja",
  subtotalLabel: "Rp56.000",
  tableLabel: "Meja 05",
  taxLabel: "Rp6.160",
  totalLabel: "Rp65.160",
};

describe("CustomerOrderSurface", () => {
  it("renders customer product, cart, and order status without exposing internal ids", () => {
    render(<CustomerOrderSurface {...orderProps} />);

    expect(
      screen.getByRole("region", { name: "Customer product cart dan order status" }),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Produk customer" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Cart customer" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Status order customer" })).toBeVisible();
    expect(screen.getByText("Kopi Senja - Cabang Meruya - Meja 05")).toBeVisible();
    expect(screen.getAllByText("Kopi susu signature")).toHaveLength(2);
    expect(screen.getByText("Espresso, susu segar, dan gula aren.")).toBeVisible();
    expect(screen.getByText("Rp65.160")).toBeVisible();
    expect(screen.getByText("Order A-014")).toBeVisible();
    expect(screen.getByText("Disiapkan")).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(
        /product-safe|cart-safe|customer|phone|email|payment|token|session|audit/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("calls customer actions with hidden ids only", async () => {
    const onAddProduct = vi.fn();
    const onCartQuantityChange = vi.fn();
    const onRefreshStatus = vi.fn();
    const onRemoveCartItem = vi.fn();
    const onSelectCategory = vi.fn();
    const onSubmitOrder = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomerOrderSurface
        {...orderProps}
        onAddProduct={onAddProduct}
        onCartQuantityChange={onCartQuantityChange}
        onRefreshStatus={onRefreshStatus}
        onRemoveCartItem={onRemoveCartItem}
        onSelectCategory={onSelectCategory}
        onSubmitOrder={onSubmitOrder}
      />,
    );

    const productRegion = screen.getByRole("region", { name: "Produk customer" });
    await user.click(within(productRegion).getByRole("button", { name: /Kopi susu signature/ }));
    expect(onAddProduct).toHaveBeenCalledWith("product-safe-01");

    await user.click(screen.getByRole("button", { name: /Tambah Kopi susu signature/ }));
    expect(onCartQuantityChange).toHaveBeenCalledWith("cart-safe-01", 3);

    await user.click(screen.getByRole("button", { name: "Hapus Kopi susu signature" }));
    expect(onRemoveCartItem).toHaveBeenCalledWith("cart-safe-01");

    await user.click(screen.getByRole("button", { name: /Makanan\s*1 produk/ }));
    expect(onSelectCategory).toHaveBeenCalledWith("food");

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));
    expect(onSubmitOrder).toHaveBeenCalledWith();

    await user.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(onRefreshStatus).toHaveBeenCalledWith();
  });

  it("renders empty product and cart states without inventing orders", () => {
    render(
      <CustomerOrderSurface
        {...orderProps}
        activeCategoryId="dessert"
        cartItems={[]}
        orderStatus={{ status: "draft" }}
        totalLabel="Rp0"
      />,
    );

    expect(screen.getByText("Produk kategori ini belum tersedia.")).toBeVisible();
    expect(screen.getByText("Cart masih kosong.")).toBeVisible();
    expect(screen.getByText("Belum dikirim")).toBeVisible();
    expect(screen.queryByText("Order A-014")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim pesanan" })).toBeDisabled();
  });

  it("rejects raw product, cart, order, payment, and contact fields", () => {
    expect(() =>
      render(
        <CustomerOrderSurface
          {...({
            ...orderProps,
            products: [{ ...orderProps.products[0], productId: "product-internal-01" }],
          } as unknown as CustomerOrderSurfaceProps)}
        />,
      ),
    ).toThrow(/productId/);

    expect(() =>
      render(
        <CustomerOrderSurface
          {...({
            ...orderProps,
            cartItems: [{ ...orderProps.cartItems[0], cartId: "cart-internal-01" }],
          } as unknown as CustomerOrderSurfaceProps)}
        />,
      ),
    ).toThrow(/cartId/);

    expect(() =>
      render(
        <CustomerOrderSurface
          {...({
            ...orderProps,
            orderStatus: { ...orderProps.orderStatus, orderId: "order-internal-01" },
          } as unknown as CustomerOrderSurfaceProps)}
        />,
      ),
    ).toThrow(/orderId/);

    expect(() =>
      render(
        <CustomerOrderSurface
          {...({
            ...orderProps,
            paymentPayload: {},
          } as unknown as CustomerOrderSurfaceProps)}
        />,
      ),
    ).toThrow(/paymentPayload/);

    expect(() =>
      render(
        <CustomerOrderSurface
          {...({
            ...orderProps,
            onPayOrder: () => undefined,
          } as CustomerOrderSurfaceProps & { onPayOrder: () => void })}
        />,
      ),
    ).toThrow(/onPayOrder/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<CustomerOrderSurface {...orderProps} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
