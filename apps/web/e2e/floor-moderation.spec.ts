import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { resolve } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import id from "../messages/id.json";
import en from "../messages/en.json";

const dedicated = process.env.PLAYWRIGHT_FLOOR_DISPOSABLE === "1";
test.skip(!dedicated, "Use test:e2e:moderation with its disposable API/database.");
type Role = "owner" | "cashier" | "waiter" | "reader";
type Fixture = {
  tenantId: string;
  outletId: string;
  tableId: string;
  cookies: Record<Role, { name: string; value: string }[]>;
};
type Snapshot = {
  sessionId: string;
  orders: {
    id: string;
    orderNumber: number;
    moderationStatus: string;
    status: string;
    cancelReason: string | null;
  }[];
  tickets: number;
  bills: number;
  submittedEvents: number;
};
let api: ChildProcess;
let fixture: Fixture;
const base = "http://localhost:4100";
let browserErrors: string[] = [];
const watchErrors = (page: Page) =>
  page.on("pageerror", (error) => browserErrors.push(error.message));
test.beforeEach(async ({ page }) => {
  browserErrors = [];
  watchErrors(page);
});
test.afterEach(() => expect(browserErrors).toEqual([]));

test.beforeAll(async () => {
  test.setTimeout(90_000);
  api = fork(resolve("../api/test/floor-browser-fixture.mjs"), {
    cwd: resolve("../api"),
    execArgv: ["--env-file-if-exists=../../.env", "--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  api.stdout?.resume();
  api.stderr?.resume();
  fixture = await new Promise<Fixture>((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("Floor fixture setup timed out.")), 60_000);
    api.once("error", reject);
    api.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Floor fixture exited before readiness."));
    });
    api.on("message", (value: unknown) => {
      const message = value as { type?: string; data?: Fixture; message?: string };
      if (message.type === "ready" && message.data) {
        clearTimeout(timeout);
        accept(message.data);
      } else if (message.type === "failed") {
        clearTimeout(timeout);
        reject(new Error(message.message ?? "Floor fixture failed."));
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
function rpc<T>(type: "reset" | "snapshot", seed = 0): Promise<T> {
  return new Promise((accept, reject) => {
    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      api.off("message", listener);
      reject(new Error("Floor scenario timed out."));
    }, 30_000);
    function listener(value: unknown) {
      const message = value as { id?: string; type?: string; data?: T; message?: string };
      if (message.id !== requestId) return;
      clearTimeout(timeout);
      api.off("message", listener);
      if (message.type === "result") accept(message.data as T);
      else reject(new Error(message.message ?? "Floor scenario failed."));
    }
    api.on("message", listener);
    api.send({ type, id: requestId, seed });
  });
}
const snapshot = () => rpc<Snapshot>("snapshot");
async function open(page: Page, role: Role, selected = true, locale = "id") {
  await page.context().addCookies([
    ...fixture.cookies[role].map((cookie) => ({
      ...cookie,
      url: base,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
    { name: "locale", value: locale, url: base },
  ]);
  await page.goto(`/pos/tables${selected ? `?table=${fixture.tableId}` : ""}`);
}
const row = (page: Page, number: number, locale: "id" | "en" = "id") =>
  page.getByRole("listitem", {
    name: `${locale === "id" ? "Pesanan" : "Order"} ${number}`,
    exact: true,
  });
async function capture(page: Page, info: TestInfo, name: string) {
  // Keep sticky shell chrome at its real top position in full-page evidence.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) {
    await page.screenshot({ path: info.outputPath(`${name}-overflow.png`), fullPage: true });
    const geometry = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((node) => ({
          tag: node.tagName,
          classes: node.className,
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
        }))
        .filter((node) => node.right > innerWidth + 1 || node.left < -1)
        .slice(0, 15),
    );
    expect(overflow, `${name}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(1);
  }
  expect(await page.locator(".ui-panel .ui-panel").count()).toBe(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled", fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

test("guest submit waits; cashier accepts to KDS, rejects another round and can retry without losing the reason", async ({
  page,
  browser,
}, info) => {
  const { token } = await rpc<{ token: string }>("reset");
  const guestContext = await browser.newContext({
    baseURL: base,
    locale: "id-ID",
    viewport: { width: 320, height: 900 },
  });
  try {
    const guest = await guestContext.newPage();
    watchErrors(guest);
    async function placeTea() {
      await guest.goto(`/t/${token}`);
      await guest.getByRole("button", { name: /Teh/ }).click();
      await guest.locator(".ui-sticky-cart-bar__button").click();
      await guest
        .getByRole("dialog")
        .getByRole("button", { name: "Kirim pesanan", exact: true })
        .click();
      await expect(guest.getByText(id.guest.status.PENDING, { exact: true }).first()).toBeVisible();
    }
    await placeTea();
    let seen = await snapshot();
    const first = seen.orders[0]!;
    expect(seen.tickets).toBe(0);
    expect(seen.bills).toBe(0);
    expect(seen.submittedEvents).toBe(0);
    await open(page, "cashier", false);
    // Discovery uses the existing tile, not a second queue with repeated order facts.
    await page.getByRole("button", { name: /T1,.*1 pesanan menunggu persetujuan staf/ }).click();
    const firstRow = row(page, first.orderNumber);
    await expect(firstRow.getByText(id.floor.orderPending, { exact: true })).toHaveCount(1);
    await expect(firstRow.getByText(id.floor.orderEstimate, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: id.floor.pay, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: id.floor.closeVisit, exact: true })).toHaveCount(
      0,
    );
    let accepts = 0;
    let releaseAccept!: () => void;
    const allowAccept = new Promise<void>((done) => {
      releaseAccept = done;
    });
    await page.route(`**/floor/guest-orders/${first.id}/accept`, async (route) => {
      accepts++;
      await allowAccept;
      await route.continue();
    });
    await firstRow.getByRole("button", { name: id.floor.acceptGuestOrder }).click();
    try {
      await expect(
        firstRow.getByRole("button", { name: id.floor.rejectGuestOrder }),
      ).toBeDisabled();
      await expect(firstRow.getByText(id.floor.orderPending, { exact: true })).toBeVisible();
      expect((await snapshot()).tickets).toBe(0);
    } finally {
      releaseAccept();
    }
    await expect(firstRow.getByText(id.floor.orderAcceptedUnpaid, { exact: true })).toBeVisible();
    expect(accepts).toBe(1);
    await expect.poll(async () => (await snapshot()).tickets).toBe(1);
    seen = await snapshot();
    expect(seen.submittedEvents).toBe(1);
    expect(seen.bills).toBe(0);
    await capture(page, info, "cashier-accepted");
    await open(page, "owner");
    await page.goto("/kds");
    const ticket = page.getByRole("article", { name: `Ticket #${first.orderNumber}`, exact: true });
    await expect(ticket.getByText("T1", { exact: true })).toBeVisible();
    await ticket.getByRole("button", { name: "Terima", exact: true }).click();
    await ticket.getByRole("button", { name: "Mulai siapkan", exact: true }).click();
    await expect.poll(async () => (await snapshot()).orders[0]?.status).toBe("PREPARING");
    await guest.reload();
    await guest.getByRole("tab", { name: /^Pesanan/ }).click();
    await expect(
      guest.getByRole("list", { name: /Progres pesanan/ }).locator('[aria-current="step"]'),
    ).toHaveText(id.guest.status.PREPARING);
    await placeTea();
    seen = await snapshot();
    const second = seen.orders[1]!;
    await open(page, "cashier");
    const secondRow = row(page, second.orderNumber);
    await secondRow.getByRole("button", { name: id.floor.rejectGuestOrder }).click();
    const reason = secondRow.getByLabel(id.floor.rejectReason);
    await expect(reason).toBeFocused();
    await secondRow.getByRole("button", { name: id.floor.rejectGuestOrder }).click();
    await expect(secondRow.getByText(id.floor.rejectReasonInvalid, { exact: true })).toBeVisible();
    await reason.fill("Bahan habis, mohon pilih minuman lain.");
    await page.route(
      `**/floor/guest-orders/${second.id}/reject`,
      (route) =>
        route.fulfill({
          status: 503,
          json: {
            code: "API_REQUEST_FAILED",
            message: "Temporary test failure",
            requestId: "test-retry",
          },
        }),
      { times: 1 },
    );
    await secondRow.getByRole("button", { name: id.floor.rejectGuestOrder }).click();
    await expect(secondRow.getByRole("button", { name: id.floor.rejectGuestOrder })).toBeEnabled();
    await expect(reason).toHaveValue("Bahan habis, mohon pilih minuman lain.");
    expect((await snapshot()).orders[1]?.moderationStatus).toBe("PENDING");
    await capture(page, info, "reject-retry-retains-reason");
    await secondRow.getByRole("button", { name: id.floor.rejectGuestOrder }).click();
    await expect(secondRow.getByText(id.floor.orderRejected, { exact: true })).toBeVisible();
    seen = await snapshot();
    expect(seen.orders[1]).toMatchObject({
      moderationStatus: "REJECTED",
      status: "CANCELED",
      cancelReason: "Bahan habis, mohon pilih minuman lain.",
    });
    expect(seen.tickets).toBe(1);
    expect(seen.submittedEvents).toBe(1);
    expect(seen.bills).toBe(0);
    await expect(page.getByRole("button", { name: id.floor.pay, exact: true })).toBeVisible();
    await guest.reload();
    await guest.getByRole("tab", { name: /^Pesanan/ }).click();
    await expect(guest.getByText(id.guest.status.CANCELED, { exact: true })).toBeVisible();
    await expect(guest.getByText(id.guest.paidAll, { exact: true })).toHaveCount(0);
    await capture(guest, info, "guest-after-rejection-320");
  } finally {
    await guestContext.close();
  }
});

test("read-only has no mutations; waiter accepts but cannot reject, and another staff decision refreshes a conflict", async ({
  page,
  browser,
}, info) => {
  await rpc("reset", 1);
  const first = (await snapshot()).orders[0]!;
  await open(page, "reader");
  const firstRow = row(page, first.orderNumber);
  await expect(firstRow.getByText("Susu oat")).toBeVisible();
  await expect(firstRow.getByText(id.floor.orderPending, { exact: true })).toBeVisible();
  await expect(firstRow.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: id.floor.pay, exact: true })).toHaveCount(0);
  await capture(page, info, "reader-pending");
  await open(page, "waiter");
  await expect(
    row(page, first.orderNumber).getByRole("button", { name: id.floor.acceptGuestOrder }),
  ).toBeVisible();
  await expect(
    row(page, first.orderNumber).getByRole("button", { name: id.floor.rejectGuestOrder }),
  ).toHaveCount(0);
  const otherContext = await browser.newContext({ baseURL: base });
  try {
    await otherContext.addCookies(
      fixture.cookies.owner.map((cookie) => ({ ...cookie, url: base })),
    );
    await page.route(`**/floor/guest-orders/${first.id}/accept`, async (route) => {
      const response = await otherContext.request.post(
        `/api/v1/floor/guest-orders/${first.id}/reject`,
        {
          headers: {
            "x-tenant-id": fixture.tenantId,
            "x-outlet-id": fixture.outletId,
            "x-csrf-token": "floor-browser-test-csrf",
          },
          data: { reason: "Already handled by staff" },
        },
      );
      expect(response.ok()).toBe(true);
      await route.continue();
    });
    await row(page, first.orderNumber)
      .getByRole("button", { name: id.floor.acceptGuestOrder })
      .click();
    await expect(
      row(page, first.orderNumber).getByText(id.floor.orderRejected, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(id.errors.SELF_ORDER_ALREADY_DECIDED, { exact: true }),
    ).toBeVisible();
    expect((await snapshot()).tickets).toBe(0);
  } finally {
    await otherContext.close();
  }
});

test("empty visit and detail load failure offer only applicable actions and recovery", async ({
  page,
}) => {
  await rpc("reset");
  await open(page, "owner", false);
  await page.getByRole("button", { name: /^T1,/ }).click();
  await page.getByRole("button", { name: id.floor.openTable, exact: true }).click();
  await expect(page.getByText(id.floor.noOrders, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: id.floor.acceptGuestOrder })).toHaveCount(0);
  await rpc("reset", 1);
  let fail = true;
  await page.route("**/api/v1/floor/sessions/*", async (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: {
            code: "API_REQUEST_FAILED",
            message: "Temporary test failure",
            requestId: "load-test",
          },
        })
      : route.continue(),
  );
  await page.reload();
  await page.goto(`/pos/tables?table=${fixture.tableId}`);
  await expect(page.getByText(id.floor.visitLoadFailed, { exact: true })).toBeVisible();
  await expect(page.getByText(id.floor.noOrders, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: id.floor.closeVisit, exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: /Coba lagi/, exact: true }).click();
  await expect(page.getByRole("button", { name: id.floor.acceptGuestOrder })).toBeVisible();
});

test("staff pending review fits S/M/L and two languages/themes without duplicated facts", async ({
  page,
}, info) => {
  await rpc("reset", 2);
  const first = (await snapshot()).orders[0]!;
  let locale: "id" | "en" = "id",
    theme: "light" | "dark" = "light";
  await page.route("**/api/v1/auth/session", async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const session = await response.json();
    await route.fulfill({
      response,
      json: { ...session, user: { ...session.user, locale, theme } },
    });
  });
  for (const width of [320, 768, 1440])
    for (const nextTheme of ["light", "dark"] as const)
      for (const nextLocale of ["id", "en"] as const) {
        locale = nextLocale;
        theme = nextTheme;
        const messages = locale === "id" ? id : en;
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await open(page, "owner", true, locale);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const firstRow = row(page, first.orderNumber, locale);
        await expect(firstRow.getByText(messages.floor.orderPending, { exact: true })).toHaveCount(
          1,
        );
        await expect(firstRow.getByText("Susu oat")).toHaveCount(1);
        await expect(
          firstRow.getByText("Sajikan tanpa es; pisahkan pemanis dari minuman.", { exact: true }),
        ).toHaveCount(1);
        await expect(
          firstRow.getByText(
            "Pesanan rombongan: bawa minuman lebih dahulu, lalu panggil pelayan bila semua sudah siap.",
            { exact: true },
          ),
        ).toHaveCount(1);
        await expect(
          page.getByRole("button", { name: messages.floor.pay, exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: messages.floor.closeVisit, exact: true }),
        ).toHaveCount(0);
        const heights = await firstRow
          .getByRole("button")
          .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
        expect(heights.every((height) => height >= 44)).toBe(true);
        await capture(page, info, `pending-${width}-${theme}-${locale}`);
        const reject = firstRow.getByRole("button", { name: messages.floor.rejectGuestOrder });
        await reject.focus();
        await page.keyboard.press("Enter");
        const reason = firstRow.getByLabel(messages.floor.rejectReason);
        await expect(reason).toBeFocused();
        await reason.fill("Menu pilihan tamu tidak tersedia untuk sementara waktu.");
        await reason.scrollIntoViewIfNeeded();
        await capture(page, info, `reason-${width}-${theme}-${locale}`);
        await firstRow.getByRole("button", { name: messages.floor.cancel, exact: true }).click();
        await expect(reject).toBeFocused();
        expect((await snapshot()).submittedEvents).toBe(0);
      }
});
