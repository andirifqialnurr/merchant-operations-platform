import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import id from "../messages/id.json";
import en from "../messages/en.json";

test.skip(
  process.env.PLAYWRIGHT_RECEIPT_DISPOSABLE !== "1",
  "Use test:e2e:receipts with its owned API/database.",
);
type Workspace = {
  tenantId: string;
  outletId: string;
  currency: string;
  cashShared: { orderIds: string[]; orderNumbers: number[] };
  transferShared: { orderIds: string[]; orderNumbers: number[] };
  singleCash: { orderId: string; orderNumber: number };
};
type Fixture = {
  workspaces: Record<"idr" | "usd", Workspace>;
  cookies: Record<"owner" | "cashier" | "reader", { name: string; value: string }[]>;
};
let api: ChildProcess, fixture: Fixture;
let errors: string[];
const base = "http://localhost:4100";
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));
test.beforeAll(async () => {
  test.setTimeout(90_000);
  api = fork(resolve("../api/test/receipt-browser-fixture.mjs"), {
    cwd: resolve("../api"),
    execArgv: ["--env-file-if-exists=../../.env", "--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  api.stdout?.resume();
  api.stderr?.resume();
  fixture = await new Promise<Fixture>((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("Receipt fixture timed out.")), 60_000);
    api.once("error", reject);
    api.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Receipt fixture exited before readiness."));
    });
    api.on("message", (value: unknown) => {
      const message = value as { type?: string; data?: Fixture; message?: string };
      if (message.type === "ready" && message.data) {
        clearTimeout(timeout);
        accept(message.data);
      } else if (message.type === "failed") {
        clearTimeout(timeout);
        reject(new Error(message.message ?? "Receipt fixture failed."));
      }
    });
  });
});
test.afterAll(async () => {
  if (!api || api.exitCode !== null || !api.connected) return;
  const exited = once(api, "exit");
  api.send({ type: "stop" });
  await exited;
});

async function prepare(
  page: Page,
  workspace: "idr" | "usd" = "idr",
  role: "owner" | "cashier" = "owner",
) {
  await page.context().addCookies(
    fixture.cookies[role].map((cookie) => ({
      ...cookie,
      url: base,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
  );
  await page.addInitScript(
    (selection) => {
      localStorage.setItem("merchant-operations-context", JSON.stringify(selection));
      const target = window as typeof window & { receiptPrintCount: number };
      target.receiptPrintCount = 0;
      window.print = () => {
        target.receiptPrintCount += 1;
      };
    },
    {
      tenantId: fixture.workspaces[workspace].tenantId,
      outletId: fixture.workspaces[workspace].outletId,
    },
  );
}
async function openOrders(
  page: Page,
  workspace: "idr" | "usd",
  locale: "id" | "en",
  theme: "light" | "dark",
) {
  await page.context().addCookies([{ name: "locale", value: locale, url: base }]);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce", media: "screen" });
  await page.goto("/pos/orders");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator(".ui-context-switcher__summary strong")).toHaveText(
    `Receipt ${workspace.toUpperCase()}`,
  );
}
async function preferences(
  page: Page,
  current: () => { locale: "id" | "en"; theme: "light" | "dark" },
) {
  await page.route("**/api/v1/auth/session", async (route) => {
    const response = await route.fetch();
    const session = await response.json();
    await route.fulfill({
      response,
      json: { ...session, user: { ...session.user, ...current() } },
    });
  });
}
async function openReceipt(page: Page, number: number, locale: "id" | "en" = "id") {
  const m = locale === "id" ? id : en;
  await page
    .locator("tbody tr")
    .filter({ has: page.getByText(`#${number}`, { exact: true }) })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: m.pos.receipt, exact: true }).click();
  return page.getByRole("dialog", { name: m.pos.receipt, exact: true });
}
const moneyDigits = (text: string) => text.replace(/[^0-9-]/g, "");
async function allocatedAmount(page: Page, label: string) {
  const row = page
    .locator(".ui-receipt__row")
    .filter({ has: page.getByText(label, { exact: true }) });
  await expect(row).toHaveCount(1);
  return moneyDigits(await row.locator("dd").innerText());
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) {
    await page.screenshot({ path: info.outputPath(`${name}-overflow.png`), fullPage: true });
    const nodes = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((node) => ({
          tag: node.tagName,
          classes: node.className,
          right: node.getBoundingClientRect().right,
        }))
        .filter((node) => node.right > innerWidth + 1)
        .slice(0, 12),
    );
    expect(overflow, JSON.stringify(nodes)).toBeLessThanOrEqual(1);
  }
  if (await page.locator(".ui-receipt").count())
    expect(
      await page.locator(".ui-receipt").evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
  expect(await page.locator(".ui-panel .ui-panel").count()).toBe(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("shared cash is an order allocation, never group tender/change, across S/M/L themes/languages and print media", async ({
  page,
}, info) => {
  await prepare(page, "idr", "cashier");
  let locale: "id" | "en" = "id",
    theme: "light" | "dark" = "light";
  await preferences(page, () => ({ locale, theme }));
  for (const width of [320, 768, 1440])
    for (const nextTheme of ["light", "dark"] as const)
      for (const nextLocale of ["id", "en"] as const) {
        locale = nextLocale;
        theme = nextTheme;
        const m = locale === "id" ? id : en;
        await page.setViewportSize({ width, height: 900 });
        await openOrders(page, "idr", locale, theme);
        const sheet = await openReceipt(
          page,
          fixture.workspaces.idr.cashShared.orderNumbers[0]!,
          locale,
        );
        await expect(sheet.getByRole("button", { name: m.pos.print, exact: true })).toBeEnabled();
        await sheet.getByRole("radio", { name: m.pos.paper_58mm, exact: true }).click();
        const label = m.pos.allocatedPaymentMethod.replace("{method}", m.pos.methodCash);
        expect(await allocatedAmount(page, label)).toBe("50000");
        await expect(
          page.locator(".ui-receipt").getByText(m.pos.change, { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator(".ui-receipt")).not.toContainText("100.000");
        await capture(page, info, `shared-${width}-${theme}-${locale}`);
      }
  for (const paper of ["58mm", "80mm", "a4"] as const) {
    await page.getByRole("radio", { name: en.pos[`paper_${paper}`], exact: true }).click();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(`.ui-receipt--${paper}`)).toBeVisible();
    expect(
      await page
        .getByRole("heading", { name: en.pos.orders, exact: true, includeHidden: true })
        .evaluate((node) => getComputedStyle(node).visibility),
    ).toBe("hidden");
    expect(await page.locator(".ui-receipt").evaluate((node) => getComputedStyle(node).color)).toBe(
      "rgb(9, 10, 12)",
    );
    await capture(page, info, `print-${paper}`);
    await page.emulateMedia({ media: "screen" });
  }
});

test("single-order cash retains tender/change and non-cash shared receipts retain references", async ({
  page,
}, info) => {
  await prepare(page);
  await preferences(page, () => ({ locale: "en", theme: "light" }));
  await page.setViewportSize({ width: 320, height: 900 });
  await openOrders(page, "idr", "en", "light");
  let sheet = await openReceipt(page, fixture.workspaces.idr.singleCash.orderNumber, "en");
  await expect(sheet.getByRole("button", { name: en.pos.print, exact: true })).toBeEnabled();
  expect(await allocatedAmount(page, en.pos.methodCash)).toBe("50000");
  expect(await allocatedAmount(page, en.pos.change)).toBe("25000");
  await capture(page, info, "single-cash-320-en");
  await sheet.getByRole("button", { name: en.pos.closeSheet, exact: true }).click();
  sheet = await openReceipt(page, fixture.workspaces.idr.transferShared.orderNumbers[1]!, "en");
  await expect(sheet.getByRole("button", { name: en.pos.print, exact: true })).toBeEnabled();
  expect(
    await allocatedAmount(
      page,
      en.pos.allocatedPaymentMethod.replace("{method}", en.pos.methodTransfer),
    ),
  ).toBe("25000");
  await expect(page.locator(".ui-receipt")).toContainText("BANK-RECEIPT-001");
  await expect(page.locator(".ui-receipt").getByText(en.pos.change, { exact: true })).toHaveCount(
    0,
  );
  await capture(page, info, "shared-transfer-320-en");
});

test("USD cents print the allocated order amount without the global cash/change", async ({
  page,
}, info) => {
  await prepare(page, "usd");
  await preferences(page, () => ({ locale: "en", theme: "dark" }));
  await page.setViewportSize({ width: 320, height: 900 });
  await openOrders(page, "usd", "en", "dark");
  const sheet = await openReceipt(page, fixture.workspaces.usd.cashShared.orderNumbers[0]!, "en");
  await expect(sheet.getByRole("button", { name: en.pos.print, exact: true })).toBeEnabled();
  expect(
    await allocatedAmount(
      page,
      en.pos.allocatedPaymentMethod.replace("{method}", en.pos.methodCash),
    ),
  ).toBe("1025");
  await expect(page.locator(".ui-receipt")).toContainText("10.25");
  await expect(page.locator(".ui-receipt").getByText(en.pos.change, { exact: true })).toHaveCount(
    0,
  );
  await capture(page, info, "usd-320-dark-en");
});

test("reopening refreshes refunds; cached receipt cannot print through fetch/error and retry restores it", async ({
  page,
}, info) => {
  await prepare(page);
  await preferences(page, () => ({ locale: "id", theme: "light" }));
  await page.setViewportSize({ width: 320, height: 900 });
  await openOrders(page, "idr", "id", "light");
  const scope = fixture.workspaces.idr,
    orderId = scope.cashShared.orderIds[0]!;
  let sheet = await openReceipt(page, scope.cashShared.orderNumbers[0]!);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  const refund = await page.request.post(`/api/v1/pos/orders/${orderId}/refunds`, {
    headers: {
      "x-tenant-id": scope.tenantId,
      "x-outlet-id": scope.outletId,
      "x-csrf-token": "receipt-browser-test-csrf",
      "idempotency-key": randomUUID(),
    },
    data: { amountMinor: "10000", reason: "Item returned by guest" },
  });
  expect(refund.status()).toBe(200);
  sheet = await openReceipt(page, scope.cashShared.orderNumbers[0]!);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
  expect(await allocatedAmount(page, id.pos.refund)).toBe("-10000");
  expect(
    await allocatedAmount(
      page,
      id.pos.allocatedPaymentMethod.replace("{method}", id.pos.methodCash),
    ),
  ).toBe("50000");
  await capture(page, info, "refund-refreshed-320");
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  await page.context().setOffline(true);
  sheet = await openReceipt(page, scope.cashShared.orderNumbers[0]!);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeDisabled();
  await expect(page.locator(".ui-receipt")).toHaveCount(0);
  await capture(page, info, "paused-cache-320");
  await page.context().setOffline(false);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  let failing = true,
    unsupported = false,
    release!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  await page.route(`**/api/v1/pos/orders/${orderId}/receipt`, async (route) => {
    await held;
    if (unsupported)
      await route.fulfill({
        status: 409,
        json: {
          code: "RECEIPT_ALLOCATION_UNAVAILABLE",
          message: "Unsupported allocation",
          requestId: "receipt-scope",
        },
      });
    else if (failing)
      await route.fulfill({
        status: 503,
        json: {
          code: "SERVICE_UNAVAILABLE",
          message: "Fixture read failure",
          requestId: "receipt-read",
        },
      });
    else await route.continue();
  });
  sheet = await openReceipt(page, scope.cashShared.orderNumbers[0]!);
  const print = sheet.getByRole("button", { name: id.pos.print, exact: true });
  await expect(print).toBeDisabled();
  await expect(page.locator(".ui-receipt")).toHaveCount(0);
  release();
  await expect(sheet.getByText(id.pos.receiptLoadFailed, { exact: true })).toBeVisible();
  await expect(print).toBeDisabled();
  await expect(page.locator(".ui-receipt")).toHaveCount(0);
  await print.evaluate((node) => (node as HTMLButtonElement).click());
  expect(
    await page.evaluate(
      () => (window as typeof window & { receiptPrintCount: number }).receiptPrintCount,
    ),
  ).toBe(0);
  await capture(page, info, "cached-error-320");
  failing = false;
  await sheet.getByRole("button", { name: id.pos.retry, exact: true }).click();
  await expect(print).toBeEnabled();
  expect(await allocatedAmount(page, id.pos.refund)).toBe("-10000");
  await print.click();
  expect(
    await page.evaluate(
      () => (window as typeof window & { receiptPrintCount: number }).receiptPrintCount,
    ),
  ).toBe(1);
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  unsupported = true;
  sheet = await openReceipt(page, scope.cashShared.orderNumbers[0]!);
  await expect(
    sheet.getByText(id.errors.RECEIPT_ALLOCATION_UNAVAILABLE, { exact: true }),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: id.pos.retry, exact: true })).toHaveCount(0);
  await expect(page.locator(".ui-receipt")).toHaveCount(0);
  await capture(page, info, "unsupported-allocation-320");
});
