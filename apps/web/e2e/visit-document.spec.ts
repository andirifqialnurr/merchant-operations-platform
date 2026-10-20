import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import id from "../messages/id.json";
import en from "../messages/en.json";

test.skip(
  process.env.PLAYWRIGHT_VISIT_DOCUMENT_DISPOSABLE !== "1",
  "Use the owned visit-document runner.",
);
type Visit = { sessionId: string; label: string; tableId: string; orderIds: string[] };
type Scope = {
  tenantId: string;
  outletId: string;
  cashShared: { sessionId: string; orderIds: string[] };
  transferShared: { sessionId: string };
};
type Fixture = {
  workspaces: Record<"idr" | "usd", Scope>;
  cookies: Record<"owner" | "cashier" | "reader", { name: string; value: string }[]>;
  visits: Record<string, Visit>;
};
let fixture: Fixture, api: ChildProcess;
let errors: string[];
const base = "http://localhost:4100";
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));
test.beforeAll(async () => {
  test.setTimeout(90_000);
  api = fork(resolve("../api/test/visit-document-browser-fixture.mjs"), {
    cwd: resolve("../api"),
    execArgv: ["--env-file-if-exists=../../.env", "--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  api.stdout?.resume();
  api.stderr?.resume();
  fixture = await new Promise<Fixture>((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("Visit fixture timed out.")), 60_000);
    api.once("error", reject);
    api.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Visit fixture exited before readiness."));
    });
    api.on("message", (value: unknown) => {
      const message = value as { type?: string; data?: Fixture; message?: string };
      if (message.type === "ready" && message.data) {
        clearTimeout(timeout);
        accept(message.data);
      }
      if (message.type === "failed") {
        clearTimeout(timeout);
        reject(new Error(message.message));
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
  current: () => { locale: "id" | "en"; theme: "light" | "dark" },
  workspace: "idr" | "usd" = "idr",
  role: "owner" | "cashier" | "reader" = "owner",
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
    (scope) => {
      localStorage.setItem("merchant-operations-context", JSON.stringify(scope));
      const target = window as typeof window & { printCount: number };
      target.printCount = 0;
      window.print = () => {
        target.printCount++;
      };
    },
    {
      tenantId: fixture.workspaces[workspace].tenantId,
      outletId: fixture.workspaces[workspace].outletId,
    },
  );
  await page.route("**/api/v1/auth/session", async (route) => {
    const response = await route.fetch();
    const session = await response.json();
    await route.fulfill({
      response,
      json: { ...session, user: { ...session.user, ...current() } },
    });
  });
}
async function table(page: Page, sessionId: string, locale: "id" | "en", theme: "light" | "dark") {
  const scope = Object.values(fixture.workspaces).find(
    (workspace) =>
      workspace.cashShared.sessionId === sessionId ||
      workspace.transferShared.sessionId === sessionId,
  );
  // The live endpoint supplies table/session mapping; no fake staff mutation is routed.
  const workspace = scope ?? fixture.workspaces.idr;
  const live = await page.request.get("/api/v1/floor/live", {
    headers: { "x-tenant-id": workspace.tenantId, "x-outlet-id": workspace.outletId },
  });
  expect(live.status()).toBe(200);
  const data = (await live.json()) as { tables: { id: string; sessionId: string | null }[] };
  const selected = data.tables.find((item) => item.sessionId === sessionId)!;
  expect(selected).toBeTruthy();
  await page.context().addCookies([{ name: "locale", value: locale, url: base }]);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce", media: "screen" });
  await page.goto(`/pos/tables?table=${selected.id}`);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
async function open(page: Page, locale: "id" | "en" = "id") {
  const m = locale === "id" ? id : en;
  await page.getByRole("button", { name: m.visitDocument.open, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: m.visitDocument.title, exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}
const receipt = (page: Page) => page.locator(".ui-receipt");
async function amount(page: Page, label: string) {
  const row = receipt(page)
    .locator(".ui-receipt__row")
    .filter({ has: page.getByText(label, { exact: true }) });
  await expect(row).toHaveCount(1);
  return (await row.locator("dd").innerText()).replace(/[^0-9]/g, "");
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  if (await receipt(page).count()) {
    expect(
      await receipt(page).evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    const overlaps = await receipt(page)
      .locator(".ui-receipt__row, .ui-receipt__line")
      .evaluateAll(
        (rows) =>
          rows.filter((row) => {
            const [first, last] = [...row.children];
            if (!first || !last || first === last) return false;
            return first.getBoundingClientRect().right + 7 > last.getBoundingClientRect().left;
          }).length,
      );
    expect(overlaps).toBe(0);
  }
  expect(await page.locator(".ui-receipt .ui-receipt, .ui-panel .ui-panel").count()).toBe(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("shared visit receipt has two order groups and one cash transaction across S/M/L, themes/languages and papers", async ({
  page,
}, info) => {
  let locale: "id" | "en" = "id",
    theme: "light" | "dark" = "light";
  await prepare(page, () => ({ locale, theme }), "idr", "cashier");
  for (const width of [320, 768, 1440])
    for (const nextTheme of ["light", "dark"] as const)
      for (const nextLocale of ["id", "en"] as const) {
        locale = nextLocale;
        theme = nextTheme;
        const m = locale === "id" ? id : en;
        await page.setViewportSize({ width, height: 900 });
        await table(page, fixture.workspaces.idr.cashShared.sessionId, locale, theme);
        const sheet = await open(page, locale);
        await expect(sheet.getByRole("button", { name: m.pos.print, exact: true })).toBeEnabled();
        await sheet.getByRole("radio", { name: m.pos.paper_58mm, exact: true }).click();
        expect(await amount(page, m.visitDocument.paymentAmount)).toBe("75000");
        expect(await amount(page, m.visitDocument.tendered)).toBe("100000");
        expect(await amount(page, m.visitDocument.change)).toBe("25000");
        await expect(
          receipt(page).getByText(m.visitDocument.methodCash, { exact: true }),
        ).toHaveCount(1);
        await expect(receipt(page).locator(".ui-receipt__group-title")).toHaveCount(3);
        for (const control of [
          ...(await sheet.getByRole("button").all()),
          ...(await sheet.getByRole("radio").all()),
        ])
          expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(48);
        await capture(page, info, `visit-${width}-${theme}-${locale}`);
      }
  await page.getByRole("button", { name: en.pos.print, exact: true }).click();
  expect(
    await page.evaluate(() => (window as typeof window & { printCount: number }).printCount),
  ).toBe(1);
  for (const paper of ["58mm", "80mm", "a4"] as const) {
    await page.getByRole("radio", { name: en.pos[`paper_${paper}`], exact: true }).click();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(`.ui-receipt--${paper}`)).toBeVisible();
    expect(await receipt(page).evaluate((node) => getComputedStyle(node).position)).toBe("static");
    expect(await receipt(page).evaluate((node) => getComputedStyle(node).color)).toBe(
      "rgb(9, 10, 12)",
    );
    await expect(page.getByRole("button", { name: en.pos.print, exact: true })).toBeHidden();
    await capture(page, info, `visit-print-${paper}`);
    await page.emulateMedia({ media: "screen" });
  }
});

test("empty/pending/mixed/partial and legacy/non-cash documents conditionally show facts without fake prices or repeated payments", async ({
  page,
}, info) => {
  await prepare(page, () => ({ locale: "id", theme: "dark" }));
  await page.setViewportSize({ width: 320, height: 900 });
  for (const key of ["empty", "pending", "mixed", "partial", "legacy"]) {
    await table(page, fixture.visits[key]!.sessionId, "id", "dark");
    const sheet = await open(page);
    await expect(receipt(page)).toBeVisible();
    if (key === "empty") {
      await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeDisabled();
      await expect(receipt(page).locator(".ui-receipt__row dd")).toHaveText([/#\d+/, "T3"]);
    } else
      await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
    if (key === "pending") {
      await expect(receipt(page).locator(".ui-receipt__line > span")).toHaveCount(1);
      await expect(receipt(page).getByText(id.visitDocument.due, { exact: true })).toHaveCount(0);
    }
    if (key === "mixed") {
      await expect(
        receipt(page).getByText(id.visitDocument.state.PENDING, { exact: true }),
      ).toHaveCount(1);
      expect(await amount(page, id.visitDocument.paymentAmount)).toBe("50000");
    }
    if (key === "partial") {
      expect(await amount(page, id.visitDocument.due)).toBe("50000");
      await expect(
        receipt(page).getByText(id.visitDocument.state.PARTIALLY_PAID, { exact: true }),
      ).toHaveCount(1);
    }
    if (key === "legacy") {
      await expect(
        receipt(page).getByText(id.visitDocument.paymentAmount, { exact: true }),
      ).toHaveCount(2);
      await expect(receipt(page).getByText("BANK-LEGACY-001", { exact: true })).toHaveCount(1);
    }
    await capture(page, info, `state-${key}-320-dark-id`);
    if (key === "legacy") {
      await receipt(page).locator(".ui-receipt__group").last().scrollIntoViewIfNeeded();
      await capture(page, info, "legacy-last-payment-320-dark-id");
    }
  }
  await table(page, fixture.workspaces.idr.transferShared.sessionId, "id", "dark");
  await open(page);
  await expect(receipt(page).getByText("BANK-RECEIPT-001", { exact: true })).toHaveCount(1);
  await expect(receipt(page).getByText(id.visitDocument.change, { exact: true })).toHaveCount(0);
  await capture(page, info, "transfer-320-dark-id");
});

test("USD document uses server currency, not the language or previous workspace", async ({
  page,
}, info) => {
  await prepare(page, () => ({ locale: "en", theme: "dark" }), "usd");
  await page.setViewportSize({ width: 768, height: 900 });
  await table(page, fixture.workspaces.usd.cashShared.sessionId, "en", "dark");
  await open(page, "en");
  expect(await amount(page, en.visitDocument.paymentAmount)).toBe("3075");
  await expect(receipt(page)).toContainText("30.75");
  await capture(page, info, "usd-768-dark-en");
});

test("actual payment and claim confirmation retain their visit ID for the result's document action", async ({
  page,
}, info) => {
  await prepare(page, () => ({ locale: "id", theme: "light" }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await table(page, fixture.visits.flow!.sessionId, "id", "light");
  await page.getByRole("button", { name: id.floor.pay, exact: true }).click();
  await page.getByLabel(id.pos.tendered, { exact: true }).fill("100000");
  await page.getByRole("button", { name: id.pos.confirmPayment, exact: true }).click();
  await expect(page.getByRole("heading", { name: id.floor.visitPaid, exact: true })).toBeVisible();
  await open(page);
  expect(await amount(page, id.visitDocument.paymentAmount)).toBe("50000");
  await capture(page, info, "paid-flow-document");
  await page.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  await page.getByRole("button", { name: id.floor.backToTables, exact: true }).click();
  await table(page, fixture.visits.claim!.sessionId, "id", "light");
  await page.getByRole("button", { name: id.floor.confirmClaim, exact: true }).click();
  await expect(page.getByRole("heading", { name: id.floor.visitPaid, exact: true })).toBeVisible();
  await open(page);
  await expect(
    receipt(page).getByText(id.visitDocument.methodTransfer, { exact: true }),
  ).toHaveCount(1);
  await capture(page, info, "claim-flow-document");
});

test("fresh refund read, paused/cache errors, retry and invalid ledger never leave stale Print enabled", async ({
  page,
}, info) => {
  await prepare(page, () => ({ locale: "id", theme: "light" }));
  await page.setViewportSize({ width: 320, height: 900 });
  const scope = fixture.workspaces.idr,
    sessionId = scope.cashShared.sessionId;
  await table(page, sessionId, "id", "light");
  let sheet = await open(page);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  const refund = await page.request.post(
    `/api/v1/pos/orders/${scope.cashShared.orderIds[0]}/refunds`,
    {
      headers: {
        "x-tenant-id": scope.tenantId,
        "x-outlet-id": scope.outletId,
        "x-csrf-token": "visit-document-browser-csrf",
        "idempotency-key": randomUUID(),
      },
      data: { amountMinor: "10000", reason: "Returned item" },
    },
  );
  expect(refund.status()).toBe(200);
  sheet = await open(page);
  expect(await amount(page, id.visitDocument.netPaid)).toBe("65000");
  await capture(page, info, "fresh-refund");
  const refundGroup = receipt(page).locator(".ui-receipt__group").last();
  await refundGroup.scrollIntoViewIfNeeded();
  await expect(refundGroup).toContainText("10.000");
  await expect(refundGroup.locator(".ui-receipt__group-title")).toContainText("Pengembalian");
  await capture(page, info, "fresh-refund-last-row");
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  await page.context().setOffline(true);
  sheet = await open(page);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeDisabled();
  await expect(sheet.getByRole("status")).toContainText(id.visitDocument.paused);
  await expect(receipt(page)).toHaveCount(0);
  await capture(page, info, "paused-cache");
  await page.context().setOffline(false);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  const url = `**/api/v1/floor/sessions/${sessionId}/document`;
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    await held;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      json: { code: "TEMPORARY", message: "Unavailable", requestId: "visit-document-test-503" },
    });
  });
  sheet = await open(page);
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeDisabled();
  await expect(receipt(page)).toHaveCount(0);
  release();
  await expect(sheet.getByText(id.visitDocument.loadFailed, { exact: true })).toBeVisible();
  await capture(page, info, "cache-error");
  await page.unroute(url);
  await sheet.getByRole("button", { name: id.pos.retry, exact: true }).click();
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeEnabled();
  await sheet.getByRole("button", { name: id.pos.closeSheet, exact: true }).click();
  await page.route(url, (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      json: {
        code: "RECEIPT_ALLOCATION_UNAVAILABLE",
        message: "Cannot represent",
        requestId: "visit-document-test-409",
      },
    }),
  );
  sheet = await open(page);
  await expect(
    sheet.getByText(id.errors.RECEIPT_ALLOCATION_UNAVAILABLE, { exact: true }),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: id.pos.print, exact: true })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: id.pos.retry, exact: true })).toHaveCount(0);
  await expect(receipt(page)).toHaveCount(0);
  await capture(page, info, "invalid-ledger");
});

test("long visit wraps notes/names, reaches the last round and flows to multiple A4 pages without shell content", async ({
  page,
}, info) => {
  await prepare(page, () => ({ locale: "en", theme: "light" }));
  await page.setViewportSize({ width: 320, height: 900 });
  await table(page, fixture.visits.long!.sessionId, "en", "light");
  const sheet = await open(page, "en");
  await expect(sheet.getByRole("button", { name: en.pos.print, exact: true })).toBeEnabled();
  await sheet.getByRole("radio", { name: en.pos.paper_58mm, exact: true }).click();
  const last = receipt(page).locator(".ui-receipt__group").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toContainText("ronde 24");
  await capture(page, info, "long-last-round-320");
  await sheet.getByRole("radio", { name: en.pos.paper_a4, exact: true }).click();
  await page.emulateMedia({ media: "print" });
  expect(
    await receipt(page).evaluate((node) => node.getBoundingClientRect().height),
  ).toBeGreaterThan(900);
  await expect(
    page.getByRole("heading", { name: en.visitDocument.title, exact: true }),
  ).toBeHidden();
  const pdf = await page.pdf({
    path: info.outputPath("long-visit-a4.pdf"),
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect([...pdf.toString("latin1").matchAll(/\/Type\s*\/Page\b/g)].length).toBeGreaterThan(1);
  await info.attach("long-visit-a4", { body: pdf, contentType: "application/pdf" });
  await capture(page, info, "long-print-a4");
});

test("table reader has no document action; keyboard menu retains move/add-order navigation", async ({
  page,
}, info) => {
  await prepare(page, () => ({ locale: "id", theme: "light" }), "idr", "reader");
  await page.setViewportSize({ width: 320, height: 900 });
  await table(page, fixture.visits.pending!.sessionId, "id", "light");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: id.visitDocument.open, exact: true })).toHaveCount(
    0,
  );
  await capture(page, info, "read-only-320");
  // Switch to an authorized session in this disposable browser context only.
  await page.context().addCookies(
    fixture.cookies.owner.map((cookie) => ({
      ...cookie,
      url: base,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
  );
  await table(page, fixture.visits.pending!.sessionId, "id", "light");
  await open(page);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: id.visitDocument.title, exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: id.visitDocument.open, exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: id.visitDocument.moreActions, exact: true }).click();
  for (const item of await page.getByRole("menuitem").all()) {
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expect(item).toBeInViewport({ ratio: 1 });
  }
  const menuBounds = (await page.getByRole("menu").boundingBox())!;
  expect(menuBounds.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(321);
  await capture(page, info, "visit-actions-menu-320");
  await page.getByRole("menuitem", { name: id.floor.moveTable, exact: true }).click();
  await page.getByRole("button", { name: id.floor.cancel, exact: true }).click();
  await page.getByRole("button", { name: id.visitDocument.moreActions, exact: true }).click();
  await page.getByRole("menuitem", { name: id.floor.addOrder, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/pos\\?table=${fixture.visits.pending!.sessionId}`));
});
