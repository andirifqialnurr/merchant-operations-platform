"use client";

import { Clock3, RefreshCw, Send, ShoppingBag, Store } from "lucide-react";

import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { CartItem, CartSummary } from "./pos-cart";
import { CategoryRail, ProductTile, type ProductAvailability } from "./pos-catalog";
import { Badge, type FeedbackTone } from "./feedback";

export type CustomerOrderStatus =
  "draft" | "submitted" | "accepted" | "preparing" | "ready" | "served" | "closed";

export type CustomerOrderProduct = {
  availability?: ProductAvailability;
  categoryId: string;
  description?: string;
  id: string;
  imageAlt?: string;
  imageUrl?: string;
  lowStockLabel?: string;
  name: string;
  priceLabel: string;
  selected?: boolean;
};

export type CustomerOrderCategory = {
  count?: number;
  disabled?: boolean;
  id: string;
  label: string;
};

export type CustomerOrderCartItem = {
  disabled?: boolean;
  id: string;
  lineTotalLabel: string;
  maxQuantity?: number;
  modifiers?: readonly string[];
  name: string;
  noteLabel?: string;
  quantity: number;
  unitPriceLabel: string;
};

export type CustomerOrderStatusSnapshot = {
  etaLabel?: string;
  itemCountLabel?: string;
  messageLabel?: string;
  publicOrderLabel?: string;
  status: CustomerOrderStatus;
  statusLabel?: string;
};

export type CustomerOrderSurfaceProps = {
  activeCategoryId: string;
  ariaLabel?: string;
  cartItems: readonly CustomerOrderCartItem[];
  categories: readonly CustomerOrderCategory[];
  className?: string;
  disabled?: boolean;
  merchantName: string;
  onAddProduct?: (id: string) => void;
  onCartQuantityChange?: (id: string, quantity: number) => void;
  onRefreshStatus?: () => void;
  onRemoveCartItem?: (id: string) => void;
  onSelectCategory?: (id: string) => void;
  onSubmitOrder?: () => void;
  orderStatus?: CustomerOrderStatusSnapshot;
  outletName?: string;
  products: readonly CustomerOrderProduct[];
  serviceChargeLabel?: string;
  sourceLabel?: string;
  subtotalLabel: string;
  tableLabel?: string;
  taxLabel?: string;
  title?: string;
  totalLabel: string;
};

const statusMeta: Record<CustomerOrderStatus, { label: string; tone: FeedbackTone }> = {
  accepted: { label: "Diterima", tone: "info" },
  closed: { label: "Ditutup", tone: "warning" },
  draft: { label: "Belum dikirim", tone: "warning" },
  preparing: { label: "Disiapkan", tone: "info" },
  ready: { label: "Siap diambil", tone: "success" },
  served: { label: "Selesai", tone: "success" },
  submitted: { label: "Terkirim", tone: "info" },
};

const customerOrderSensitiveKeyPattern =
  /(?:productId|cartId|cartLineId|orderId|orderInternalId|customerId|customerInternalId|sessionId|paymentId|paymentToken|paymentPayload|billId|invoiceId|receiptId|phone|telepon|email|address|alamat|birth|dob|identity|nik|ktp|passport|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|audit|actor|timestamp|createdAt|updatedAt|raw|webhook|attachment|hpp|cogs|cost|profit|margin)/i;

const allowedActionProps = new Set([
  "onAddProduct",
  "onCartQuantityChange",
  "onRefreshStatus",
  "onRemoveCartItem",
  "onSelectCategory",
  "onSubmitOrder",
]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Customer order payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key) && !allowedActionProps.has(key)) {
      throw new TypeError(`${path} tidak menerima action prop di luar kontrak: ${key}.`);
    }
    if (customerOrderSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueIds(items: readonly { id: string }[], fieldName: string) {
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id.trim()) throw new TypeError(`${fieldName} memerlukan id tersembunyi.`);
    if (seen.has(item.id)) throw new TypeError(`${fieldName} tidak boleh memiliki id duplikat.`);
    seen.add(item.id);
  }
}

function assertQuantity(quantity: number, itemName: string) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(`Quantity ${itemName} harus berupa integer positif.`);
  }
}

export function CustomerOrderSurface(props: CustomerOrderSurfaceProps) {
  assertNoSensitiveProps(props);
  assertUniqueIds(props.categories, "Kategori customer order");
  assertUniqueIds(props.products, "Produk customer order");
  assertUniqueIds(props.cartItems, "Item cart customer order");

  const {
    activeCategoryId,
    ariaLabel = "Customer product cart dan order status",
    cartItems,
    categories,
    className,
    disabled = false,
    merchantName,
    onAddProduct,
    onCartQuantityChange,
    onRefreshStatus,
    onRemoveCartItem,
    onSelectCategory,
    onSubmitOrder,
    orderStatus = { status: "draft" },
    outletName,
    products,
    serviceChargeLabel,
    sourceLabel,
    subtotalLabel,
    tableLabel,
    taxLabel,
    title = "Pesan dari meja",
    totalLabel,
  } = props;

  assertText(activeCategoryId, "Kategori aktif customer order");
  assertText(ariaLabel, "Label customer order");
  assertText(merchantName, "Nama merchant customer order");
  assertText(outletName, "Outlet customer order");
  assertText(orderStatus.etaLabel, "ETA customer order");
  assertText(orderStatus.itemCountLabel, "Jumlah item customer order");
  assertText(orderStatus.messageLabel, "Pesan status customer order");
  assertText(orderStatus.publicOrderLabel, "Nomor publik customer order");
  assertText(orderStatus.statusLabel, "Label status customer order");
  assertText(serviceChargeLabel, "Service charge customer order");
  assertText(sourceLabel, "Sumber customer order");
  assertText(subtotalLabel, "Subtotal customer order");
  assertText(tableLabel, "Label meja customer order");
  assertText(taxLabel, "Pajak customer order");
  assertText(title, "Judul customer order");
  assertText(totalLabel, "Total customer order");
  categories.forEach((category) => assertText(category.label, "Label kategori customer order"));
  products.forEach((product) => {
    assertText(product.categoryId, "Kategori produk customer order");
    assertText(product.description, "Deskripsi produk customer order");
    assertText(product.imageAlt, "Alt gambar produk customer order");
    assertText(product.imageUrl, "URL gambar produk customer order");
    assertText(product.lowStockLabel, "Status stok produk customer order");
    assertText(product.name, "Nama produk customer order");
    assertText(product.priceLabel, "Harga produk customer order");
  });
  cartItems.forEach((item) => {
    assertQuantity(item.quantity, item.name);
    assertText(item.lineTotalLabel, "Total item cart customer order");
    assertText(item.name, "Nama item cart customer order");
    assertText(item.noteLabel, "Catatan item cart customer order");
    assertText(item.unitPriceLabel, "Harga satuan item cart customer order");
    item.modifiers?.forEach((modifier) =>
      assertText(modifier, "Modifier item cart customer order"),
    );
  });

  const visibleProducts = products.filter((product) => product.categoryId === activeCategoryId);
  const status = statusMeta[orderStatus.status];
  const canSubmit = !disabled && cartItems.length > 0 && Boolean(onSubmitOrder);

  return (
    <section
      aria-label={ariaLabel.trim()}
      className={classes("ui-customer-order", className)}
      data-customer-storefront
    >
      <header className="ui-customer-order__header">
        <span className="ui-customer-order__brand-icon" aria-hidden="true">
          <AppIcon icon={Store} size="lg" />
        </span>
        <div>
          <h2>{title.trim()}</h2>
          <p>
            {merchantName.trim()}
            {outletName ? ` - ${outletName.trim()}` : ""}
            {tableLabel ? ` - ${tableLabel.trim()}` : ""}
          </p>
          {sourceLabel ? <small>{sourceLabel.trim()}</small> : null}
        </div>
      </header>

      <div className="ui-customer-order__layout">
        <section aria-label="Produk customer" className="ui-customer-order-products">
          <CategoryRail
            activeId={activeCategoryId}
            categories={categories}
            onSelect={(id) => onSelectCategory?.(id)}
            orientation="horizontal"
          />

          {visibleProducts.length > 0 ? (
            <div className="ui-customer-order-products__grid">
              {visibleProducts.map((product) => {
                const productTileProps = {
                  ...(product.availability !== undefined
                    ? { availability: product.availability }
                    : {}),
                  ...(product.description !== undefined
                    ? { description: product.description }
                    : {}),
                  ...(product.imageAlt !== undefined ? { imageAlt: product.imageAlt } : {}),
                  ...(product.imageUrl !== undefined ? { imageUrl: product.imageUrl } : {}),
                  ...(product.lowStockLabel !== undefined
                    ? { lowStockLabel: product.lowStockLabel }
                    : {}),
                  ...(product.selected !== undefined ? { selected: product.selected } : {}),
                };

                return (
                  <ProductTile
                    {...productTileProps}
                    key={product.id}
                    name={product.name}
                    onClick={() => onAddProduct?.(product.id)}
                    priceLabel={product.priceLabel}
                    variant="customer"
                  />
                );
              })}
            </div>
          ) : (
            <p className="ui-customer-order__empty">Produk kategori ini belum tersedia.</p>
          )}
        </section>

        <aside className="ui-customer-order__side">
          <section aria-label="Cart customer" className="ui-customer-order-cart">
            <header>
              <span aria-hidden="true">
                <AppIcon icon={ShoppingBag} size="sm" />
              </span>
              <h3>Cart</h3>
            </header>

            {cartItems.length > 0 ? (
              <div className="ui-customer-order-cart__items">
                {cartItems.map((item) => {
                  const cartItemProps = {
                    disabled: disabled || item.disabled === true,
                    ...(item.maxQuantity !== undefined ? { maxQuantity: item.maxQuantity } : {}),
                    ...(item.modifiers !== undefined ? { modifiers: item.modifiers } : {}),
                    ...(item.noteLabel !== undefined ? { note: item.noteLabel } : {}),
                    ...(onCartQuantityChange
                      ? {
                          onQuantityChange: (quantity: number) =>
                            onCartQuantityChange(item.id, quantity),
                        }
                      : {}),
                    ...(onRemoveCartItem ? { onRemove: () => onRemoveCartItem(item.id) } : {}),
                  };

                  return (
                    <CartItem
                      {...cartItemProps}
                      key={item.id}
                      lineTotalLabel={item.lineTotalLabel}
                      name={item.name}
                      quantity={item.quantity}
                      unitPriceLabel={item.unitPriceLabel}
                      variant="compact"
                    />
                  );
                })}
              </div>
            ) : (
              <p className="ui-customer-order__empty">Cart masih kosong.</p>
            )}

            <CartSummary
              {...(serviceChargeLabel !== undefined ? { serviceChargeLabel } : {})}
              {...(taxLabel !== undefined ? { taxLabel } : {})}
              subtotalLabel={subtotalLabel}
              totalLabel={totalLabel}
            />

            <Button
              disabled={!canSubmit}
              iconLeft={Send}
              onClick={() => onSubmitOrder?.()}
              type="button"
            >
              Kirim pesanan
            </Button>
          </section>

          <section aria-label="Status order customer" className="ui-customer-order-status">
            <header>
              <span aria-hidden="true">
                <AppIcon icon={Clock3} size="sm" />
              </span>
              <div>
                <h3>Status order</h3>
                {orderStatus.publicOrderLabel ? <p>{orderStatus.publicOrderLabel.trim()}</p> : null}
              </div>
              <Badge tone={status.tone}>{orderStatus.statusLabel?.trim() || status.label}</Badge>
            </header>
            {orderStatus.messageLabel ? <p>{orderStatus.messageLabel.trim()}</p> : null}
            <dl>
              {orderStatus.itemCountLabel ? (
                <div>
                  <dt>Item</dt>
                  <dd>{orderStatus.itemCountLabel.trim()}</dd>
                </div>
              ) : null}
              {orderStatus.etaLabel ? (
                <div>
                  <dt>Estimasi</dt>
                  <dd>{orderStatus.etaLabel.trim()}</dd>
                </div>
              ) : null}
            </dl>
            {onRefreshStatus ? (
              <Button
                disabled={disabled}
                iconLeft={RefreshCw}
                onClick={() => onRefreshStatus()}
                size="sm"
                type="button"
                variant="outline"
              >
                Refresh status
              </Button>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
