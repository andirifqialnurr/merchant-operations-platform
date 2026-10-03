"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";

import {
  PERMISSIONS,
  type Checkout,
  type SellableMenu,
  type SellableMenuProduct,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Panel } from "@merchant/ui/data-display";
import { EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { CategoryRail, ProductTile } from "@merchant/ui/pos-catalog";
import { Sheet } from "@merchant/ui/sheet";

import { useWorkspace } from "@/features/workspace";
import { useErrorMessage, useFormat } from "@/lib/i18n";

import { useCurrentShift, useMenu } from "./api";
import {
  addLine,
  removeLine,
  setLineNote,
  setLineQuantity,
  toOrderItems,
  viewCart,
  type CartLine,
} from "./cart";
import { CartPanel } from "./cart-panel";
import { PaidView } from "./paid-view";
import { PaymentView } from "./payment-view";
import { ProductOptionsSheet } from "./product-options-sheet";

const ALL_CATEGORIES = "all";

function SellScreen({
  canPay,
  menu,
  outletId,
  tenantId,
}: Readonly<{ canPay: boolean; menu: SellableMenu; outletId: string; tenantId: string }>) {
  const t = useTranslations("pos");
  const { money } = useFormat();
  const [cart, setCart] = useState<readonly CartLine[]>([]);
  // One key per cart: it changes with the cart, so an edited cart is a new order.
  const [orderKey, setOrderKey] = useState(() => crypto.randomUUID());
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [choosing, setChoosing] = useState<SellableMenuProduct | undefined>();
  const [cartOpen, setCartOpen] = useState(false);
  const [stage, setStage] = useState<"pay" | "sell">("sell");
  const [checkout, setCheckout] = useState<Checkout | undefined>();

  const view = useMemo(() => viewCart(cart, menu.products), [cart, menu.products]);
  const products =
    categoryId === ALL_CATEGORIES
      ? menu.products
      : menu.products.filter((product) => product.categoryId === categoryId);

  function changeCart(next: readonly CartLine[]) {
    setCart(next);
    setOrderKey(crypto.randomUUID());
  }

  function pick(product: SellableMenuProduct) {
    if (product.variants.length > 0 || product.modifierGroups.length > 0) {
      setChoosing(product);
    } else {
      changeCart(addLine(cart, { modifierOptionIds: [], productId: product.id, quantity: 1 }));
    }
  }

  if (checkout) {
    return (
      <PaidView
        actionLabel={t("newOrder")}
        checkout={checkout}
        onDone={() => {
          setCheckout(undefined);
          changeCart([]);
          setStage("sell");
        }}
      />
    );
  }

  if (stage === "pay") {
    return (
      <PaymentView
        onBack={() => setStage("sell")}
        onLater={() => {
          changeCart([]);
          setStage("sell");
        }}
        onPaid={(result) => setCheckout(result)}
        source={{
          cartTotalMinor: view.totalMinor,
          items: toOrderItems(view.lines),
          kind: "cart",
          orderKey,
        }}
        outletId={outletId}
        tenantId={tenantId}
      />
    );
  }

  if (menu.products.length === 0) {
    return <EmptyState description={t("menuEmpty")} title={t("menuEmptyTitle")} />;
  }

  const cartPanel = (
    <CartPanel
      lines={view.lines}
      onPay={
        canPay
          ? () => {
              setCartOpen(false);
              setStage("pay");
            }
          : undefined
      }
      onNoteChange={(key, note) => changeCart(setLineNote(cart, key, note))}
      onQuantityChange={(key, quantity) => changeCart(setLineQuantity(cart, key, quantity))}
      onRemove={(key) => changeCart(removeLine(cart, key))}
      totalMinor={view.totalMinor}
    />
  );

  return (
    <>
      <h1 className="ui-visually-hidden">{t("sell")}</h1>
      <div className="grid items-start gap-4 pb-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
        <section className="grid min-w-0 gap-4">
          <CategoryRail
            activeId={categoryId}
            ariaLabel={t("categories")}
            categories={[
              { id: ALL_CATEGORIES, label: t("allCategories") },
              ...menu.categories.map((category) => ({ id: category.id, label: category.name })),
            ]}
            onSelect={setCategoryId}
            orientation="horizontal"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductTile
                key={product.id}
                name={product.name}
                onClick={() => pick(product)}
                priceLabel={money(product.priceMinor)}
                variant="compact"
              />
            ))}
          </div>
        </section>
        <aside className="sticky top-20 hidden max-h-[calc(100dvh-6.5rem)] lg:flex">
          <div className="flex min-h-0 w-full flex-col">
            <Panel title={t("cart")}>{cartPanel}</Panel>
          </div>
        </aside>
      </div>

      {/* Small screens: products stay in view; the cart opens from a summary bar. */}
      {view.itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line-default bg-surface p-3 lg:hidden">
          <Button fullWidth onClick={() => setCartOpen(true)} size="lg">
            {t("cartSummary", { count: view.itemCount })} · {money(view.totalMinor.toString())}
          </Button>
        </div>
      ) : null}
      <Sheet
        closeLabel={t("closeSheet")}
        onOpenChange={setCartOpen}
        open={cartOpen}
        title={t("cart")}
      >
        <div className="-m-4 flex min-h-0 flex-col">{cartPanel}</div>
      </Sheet>

      {choosing ? (
        <ProductOptionsSheet
          key={choosing.id}
          onAdd={(line) => {
            changeCart(addLine(cart, line));
            setChoosing(undefined);
          }}
          onClose={() => setChoosing(undefined)}
          product={choosing}
        />
      ) : null}
    </>
  );
}

function SellForOutlet({
  canPay,
  outletId,
  tenantId,
}: Readonly<{ canPay: boolean; outletId: string; tenantId: string }>) {
  const t = useTranslations("pos");
  const errorMessage = useErrorMessage();
  const shift = useCurrentShift(tenantId, outletId, true);
  const menu = useMenu(tenantId, outletId);

  if (shift.isPending || menu.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <Skeleton variant="product-card" />
        <Skeleton variant="product-card" />
        <Skeleton variant="product-card" />
        <Skeleton variant="product-card" />
      </div>
    );
  }

  const failure = shift.error ?? menu.error;
  if (failure || !shift.data || !menu.data) {
    return (
      <ErrorState
        action={
          <Button
            onClick={() => {
              void shift.refetch();
              void menu.refetch();
            }}
            variant="secondary"
          >
            {t("retry")}
          </Button>
        }
        description={errorMessage(failure)}
        title={t("menuLoadFailed")}
      />
    );
  }

  // Money is only taken inside an open shift, so selling starts there.
  if (!shift.data.session) {
    return (
      <EmptyState
        action={
          <Link className="ui-button ui-button--md ui-button--primary" href="/pos/shift">
            <span className="ui-button__label">{t("open")}</span>
          </Link>
        }
        description={t("shiftRequired")}
        title={t("shiftRequiredTitle")}
      />
    );
  }

  return <SellScreen canPay={canPay} menu={menu.data} outletId={outletId} tenantId={tenantId} />;
}

/** The cashier's sell screen: pick products, review the cart, take payment. */
export function SellPage() {
  const t = useTranslations("pos");
  const { can, outlet, workspace } = useWorkspace();

  if (!can(PERMISSIONS.orderCreate)) {
    return <ErrorState description={t("accessDenied")} title={t("accessDeniedTitle")} />;
  }
  if (!outlet) {
    return <ErrorState description={t("noOutlet")} title={t("accessDeniedTitle")} />;
  }

  // Keyed by outlet so a cart never carries over to another outlet's menu.
  return (
    <SellForOutlet
      canPay={can(PERMISSIONS.paymentConfirm)}
      key={`${workspace.tenant.id}:${outlet.id}`}
      outletId={outlet.id}
      tenantId={workspace.tenant.id}
    />
  );
}
