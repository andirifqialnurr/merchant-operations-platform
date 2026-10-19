"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type {
  ClaimMethod,
  GuestMenu,
  GuestMenuProduct,
  GuestOrder,
  PublicQrResolution,
  ServiceRequestType,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { OrderProgress, StickyCartBar } from "@merchant/ui/customer-order";
import { Badge, EmptyState, ErrorState, Spinner } from "@merchant/ui/feedback";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { Tabs } from "@merchant/ui/navigation";
import { CategoryRail, ProductTile } from "@merchant/ui/pos-catalog";
import { QuantityStepper, SegmentedControl } from "@merchant/ui/selection-control";
import { Sheet } from "@merchant/ui/sheet";

import { CartPanel, ProductOptionsSheet } from "@/features/pos";
import { localeOptions, useLocaleSwitch } from "@/i18n/use-locale-switch";
import { ApiClientError, guestApi, guestProductImageUrl } from "@/lib/api-client";
import { payable } from "@/lib/charges";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import {
  addLine,
  removeLine,
  setLineNote,
  setLineQuantity,
  toOrderItems,
  viewCart,
  type CartLine,
} from "@/lib/menu-cart";
import { useToast } from "@/providers/toast-provider";

import { addOrderAgain, GUEST_STEPS, newestFirst, reorderLines, stepOf } from "./guest-order";

const ALL_CATEGORIES = "all";
/** Guests have no live connection; their orders are looked at this often. */
const VISIT_REFRESH_MS = 15_000;
const MAX_GUESTS = 99;

const guestKeys = {
  menu: (token: string) => ["guest", token, "menu"] as const,
  resolution: (token: string) => ["guest", token] as const,
  visit: (token: string) => ["guest", token, "visit"] as const,
};

/** A QR that leads nowhere, or one whose table takes no orders now. */
type Unavailable = "closed" | "invalid";

function unavailableOf(error: unknown): Unavailable | undefined {
  if (!(error instanceof ApiClientError)) return undefined;
  if (error.code === "TABLE_QR_INVALID") return "invalid";
  if (error.code === "SELF_ORDER_CLOSED") return "closed";
  return undefined;
}

function Centered({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid min-h-[60dvh] place-items-center p-4">{children}</div>;
}

function UnavailableState({ kind }: Readonly<{ kind: Unavailable }>) {
  const t = useTranslations("guest");
  return (
    <Centered>
      <EmptyState
        description={t(kind === "invalid" ? "invalidBody" : "closedBody")}
        title={t(kind === "invalid" ? "invalidTitle" : "closedTitle")}
      />
    </Centered>
  );
}

function LanguagePicker() {
  const t = useTranslations("guest");
  const { locale, setLocale } = useLocaleSwitch();
  return (
    <SegmentedControl
      items={localeOptions.map((option) => ({
        label: option.value.toUpperCase(),
        value: option.value,
      }))}
      label={t("language")}
      onValueChange={setLocale}
      size="sm"
      value={locale}
    />
  );
}

/** Who the guest is ordering from, and at which table; shown once, at the top. */
function GuestHeader({
  children,
  resolution,
}: Readonly<{ children?: React.ReactNode; resolution: PublicQrResolution | undefined }>) {
  const t = useTranslations("guest");
  const place = [
    resolution?.outletName,
    resolution?.tableLabel ? t("table", { label: resolution.tableLabel }) : null,
  ].filter(Boolean);
  return (
    <header className="sticky top-0 z-10 border-b border-line-default bg-surface">
      <div className="mx-auto flex max-w-2xl items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <h1 className="m-0 text-heading-sm [overflow-wrap:anywhere] font-semibold">
            {resolution?.merchantName ?? t("metaFallbackTitle")}
          </h1>
          {place.length > 0 ? (
            <p className="m-0 text-body-sm [overflow-wrap:anywhere] text-foreground-secondary">
              {place.join(" · ")}
            </p>
          ) : null}
        </div>
        <LanguagePicker />
      </div>
      {children ? <div className="mx-auto max-w-2xl px-4">{children}</div> : null}
    </header>
  );
}

function OrderCard({
  menu,
  onOrderAgain,
  order,
}: Readonly<{ menu: GuestMenu; onOrderAgain: () => void; order: GuestOrder }>) {
  const t = useTranslations("guest");
  const { locale } = useFormat();
  const step = stepOf(order.status);
  const canRepeat = reorderLines(order, menu.products).length > 0;
  return (
    <li className="grid gap-3 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-label font-semibold">
          {t("orderNumber", { number: order.orderNumber })}
        </h2>
        <MoneyDisplay amountMinor={order.totalMinor} locale={locale} />
      </div>
      {step === null ? (
        <div>
          <Badge tone={order.status === "CANCELED" ? "danger" : "neutral"}>
            {t(`status.${order.status}`)}
          </Badge>
        </div>
      ) : (
        <OrderProgress
          current={step}
          label={t("orderProgress", { number: order.orderNumber })}
          steps={GUEST_STEPS.map((status) => t(`status.${status}`))}
        />
      )}
      <ul className="m-0 grid list-none gap-1 p-0 text-body-sm">
        {order.lines.map((line, index) => (
          <li key={index}>
            <span className="tabular-nums">{line.quantity}×</span> {line.name}
            {line.modifiers.length > 0 ? (
              <span className="text-foreground-secondary"> · {line.modifiers.join(", ")}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {canRepeat ? (
        <div>
          <Button onClick={onOrderAgain} size="sm" variant="secondary">
            {t("orderAgain")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Ordering({
  menu,
  resolution,
  token,
}: Readonly<{ menu: GuestMenu; resolution: PublicQrResolution | undefined; token: string }>) {
  const t = useTranslations("guest");
  const { locale, money } = useFormat();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [cart, setCart] = useState<readonly CartLine[]>([]);
  // One key per cart: a repeated tap places one order, an edited cart a new one.
  const [orderKey, setOrderKey] = useState(() => crypto.randomUUID());
  const [cartOpen, setCartOpen] = useState(false);
  const [choosing, setChoosing] = useState<GuestMenuProduct | undefined>();
  const [guests, setGuests] = useState(2);

  const visit = useQuery({
    queryFn: () => guestApi.visit(token),
    queryKey: guestKeys.visit(token),
    refetchInterval: VISIT_REFRESH_MS,
  });
  const orders = newestFirst(visit.data);
  // How many sit at the table is asked only of the first order of a visit.
  const firstOrder = visit.isSuccess && orders.length === 0;

  const view = useMemo(() => viewCart(cart, menu.products), [cart, menu.products]);
  const due = payable(view.totalMinor, menu.charges);
  const hasPictures = menu.products.some((product) => product.hasImage);
  const products =
    categoryId === ALL_CATEGORIES
      ? menu.products
      : menu.products.filter((product) => product.categoryId === categoryId);

  function changeCart(next: readonly CartLine[]) {
    setCart(next);
    setOrderKey(crypto.randomUUID());
  }

  function pick(product: GuestMenuProduct) {
    if (product.variants.length > 0 || product.modifierGroups.length > 0) {
      setChoosing(product);
    } else {
      changeCart(addLine(cart, { modifierOptionIds: [], productId: product.id, quantity: 1 }));
    }
  }

  const ask = useMutation({
    mutationFn: (type: ServiceRequestType) => guestApi.requestService(token, type),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: (next) => {
      queryClient.setQueryData(guestKeys.visit(token), next);
      notify({ message: t("requestSent"), tone: "success" });
    },
  });
  const waiting = new Set(visit.data?.requests ?? []);
  const [method, setMethod] = useState<ClaimMethod>("TRANSFER");
  // One key per claim the guest makes; a double tap is one claim.
  const [claimKey, setClaimKey] = useState(() => crypto.randomUUID());
  const claim = useMutation({
    mutationFn: () => guestApi.claimPayment(token, method, claimKey),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: (next) => {
      queryClient.setQueryData(guestKeys.visit(token), next);
      setClaimKey(crypto.randomUUID());
      notify({ message: t("claimSent"), tone: "success" });
    },
  });

  const send = useMutation({
    mutationFn: () =>
      guestApi.placeOrder(
        token,
        { items: toOrderItems(view.lines), ...(firstOrder ? { guestCount: guests } : {}) },
        orderKey,
      ),
    onError: async (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      // The table may have stopped taking orders; the page then says so.
      if (unavailableOf(error)) {
        await queryClient.invalidateQueries({ queryKey: guestKeys.resolution(token) });
      }
    },
    onSuccess: async (order) => {
      notify({ message: t("sent", { number: order.orderNumber }), tone: "success" });
      changeCart([]);
      setCartOpen(false);
      setTab("orders");
      await queryClient.invalidateQueries({ queryKey: guestKeys.visit(token) });
    },
  });

  return (
    <>
      <GuestHeader resolution={resolution}>
        <Tabs
          items={[
            { label: t("menu"), value: "menu" },
            { label: t("orders", { count: orders.length }), value: "orders" },
          ]}
          label={t("menu")}
          onValueChange={(next) => setTab(next === "orders" ? "orders" : "menu")}
          value={tab}
        />
      </GuestHeader>

      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {tab === "menu" ? (
          <div className="grid gap-4">
            {menu.categories.length > 1 ? (
              <CategoryRail
                activeId={categoryId}
                ariaLabel={t("categories")}
                categories={[
                  { id: ALL_CATEGORIES, label: t("allCategories") },
                  ...menu.categories.map((category) => ({
                    id: category.id,
                    label: category.name,
                  })),
                ]}
                onSelect={setCategoryId}
                orientation="horizontal"
              />
            ) : null}
            <div
              className={
                hasPictures
                  ? "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3"
                  : "grid grid-cols-2 gap-2 sm:grid-cols-3"
              }
            >
              {products.map((product) => (
                <ProductTile
                  key={product.id}
                  name={product.name}
                  onClick={() => pick(product)}
                  priceLabel={money(product.priceMinor)}
                  variant={hasPictures ? "customer" : "compact"}
                  {...(product.hasImage
                    ? { imageAlt: "", imageUrl: guestProductImageUrl(token, product.id) }
                    : {})}
                />
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState description={t("ordersEmptyBody")} title={t("ordersEmptyTitle")} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 pb-2">
              <Button
                disabled={waiting.has("WAITER") || ask.isPending}
                onClick={() => ask.mutate("WAITER")}
                size="sm"
                variant="secondary"
              >
                {t(waiting.has("WAITER") ? "waiterCalled" : "callWaiter")}
              </Button>
              <Button
                disabled={waiting.has("BILL") || ask.isPending}
                onClick={() => ask.mutate("BILL")}
                size="sm"
                variant="secondary"
              >
                {t(waiting.has("BILL") ? "billAsked" : "askBill")}
              </Button>
            </div>
            <ul className="m-0 list-none divide-y divide-line-subtle p-0">
              {orders.map((order) => (
                <OrderCard
                  key={order.orderNumber}
                  menu={menu}
                  onOrderAgain={() => {
                    changeCart(addOrderAgain(cart, order, menu.products));
                    notify({ message: t("orderAgainAdded"), tone: "success" });
                  }}
                  order={order}
                />
              ))}
            </ul>
            {visit.data && visit.data.dueMinor !== "0" ? (
              <div className="grid gap-3 border-t border-line-default pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-label font-semibold">{t("due")}</span>
                  <MoneyDisplay
                    amountMinor={visit.data.dueMinor}
                    locale={locale}
                    variant="summary"
                  />
                </div>
                {visit.data.claim ? (
                  <p className="m-0 text-body-sm text-foreground-secondary" role="status">
                    {t("claimWaiting")} · {t(`method.${visit.data.claim.method}`)}
                  </p>
                ) : menu.paymentNote && !orders.some((order) => order.status === "PENDING") ? (
                  <section aria-labelledby="guest-pay" className="grid gap-3">
                    <h2 className="m-0 text-label font-semibold" id="guest-pay">
                      {t("payTitle")}
                    </h2>
                    <p className="m-0 text-body-sm whitespace-pre-line">{menu.paymentNote}</p>
                    <SegmentedControl
                      items={(["TRANSFER", "MERCHANT_QRIS"] as const).map((value) => ({
                        label: t(`method.${value}`),
                        value,
                      }))}
                      label={t("payMethod")}
                      onValueChange={(value) =>
                        setMethod(value === "MERCHANT_QRIS" ? "MERCHANT_QRIS" : "TRANSFER")
                      }
                      size="sm"
                      value={method}
                    />
                    <Button loading={claim.isPending} onClick={() => claim.mutate()}>
                      {t("claimPaid")}
                    </Button>
                  </section>
                ) : null}
              </div>
            ) : visit.data &&
              !orders.some((order) => order.status === "PENDING") &&
              orders.some((order) => order.status !== "CANCELED") ? (
              <p className="m-0 border-t border-line-default pt-4 text-body-sm" role="status">
                {t("paidAll")}
              </p>
            ) : null}
          </>
        )}
      </main>

      {view.itemCount > 0 ? (
        <StickyCartBar
          countLabel={t("cartCount", { count: view.itemCount })}
          onOpen={() => setCartOpen(true)}
          totalLabel={money(due.totalMinor.toString())}
        />
      ) : null}

      <Sheet
        closeLabel={t("closeSheet")}
        onOpenChange={setCartOpen}
        open={cartOpen}
        title={t("cart")}
      >
        <div className="-m-4 flex min-h-0 flex-col">
          {firstOrder ? (
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
              <span className="text-label font-semibold">{t("guestCount")}</span>
              <QuantityStepper
                decreaseLabel={t("decreaseGuests")}
                increaseLabel={t("increaseGuests")}
                label={t("guestCount")}
                max={MAX_GUESTS}
                min={1}
                onValueChange={setGuests}
                size="sm"
                value={guests}
              />
            </div>
          ) : null}
          <CartPanel
            lines={view.lines}
            onNoteChange={(key, note) => changeCart(setLineNote(cart, key, note))}
            onQuantityChange={(key, quantity) => changeCart(setLineQuantity(cart, key, quantity))}
            onRemove={(key) => changeCart(removeLine(cart, key))}
            send={{ busy: send.isPending, label: t("send"), onSend: () => send.mutate() }}
            {...(due.added ? { totalNote: t("totalWithCharges") } : {})}
            totalMinor={due.totalMinor}
          />
        </div>
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

/**
 * A guest's page after scanning a table's QR: the menu, a cart, and the
 * orders of the visit at that table. Nothing here needs an account.
 */
export function GuestOrderPage({ token }: Readonly<{ token: string }>) {
  const t = useTranslations("guest");
  const resolution = useQuery({
    queryFn: () => guestApi.resolve(token),
    queryKey: guestKeys.resolution(token),
    retry: 1,
  });
  const ready = resolution.data?.status === "READY";
  const menu = useQuery({
    enabled: ready,
    queryFn: () => guestApi.menu(token),
    queryKey: guestKeys.menu(token),
    retry: 1,
  });

  const status = resolution.data?.status;
  const unavailable: Unavailable | undefined =
    status === "INVALID"
      ? "invalid"
      : status === "CLOSED"
        ? "closed"
        : (unavailableOf(resolution.error) ?? unavailableOf(menu.error));

  let body: React.ReactNode;
  if (unavailable) {
    body = <UnavailableState kind={unavailable} />;
  } else if (resolution.error || menu.error) {
    body = (
      <Centered>
        <ErrorState
          action={
            <Button
              onClick={() => void (resolution.error ? resolution.refetch() : menu.refetch())}
              variant="secondary"
            >
              {t("retry")}
            </Button>
          }
          description={t("menuEmptyBody")}
          title={t("loadErrorTitle")}
        />
      </Centered>
    );
  } else if (!menu.data) {
    body = (
      <Centered>
        <Spinner label={t("loading")} />
      </Centered>
    );
  } else if (menu.data.products.length === 0) {
    body = (
      <Centered>
        <EmptyState description={t("menuEmptyBody")} title={t("menuEmptyTitle")} />
      </Centered>
    );
  } else {
    return <Ordering menu={menu.data} resolution={resolution.data} token={token} />;
  }

  return (
    <>
      <GuestHeader resolution={resolution.data} />
      <main className="mx-auto max-w-2xl">{body}</main>
    </>
  );
}
