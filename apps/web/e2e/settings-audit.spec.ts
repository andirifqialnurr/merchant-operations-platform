import { randomUUID } from "node:crypto";

import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  PERMISSIONS,
  type IntegrationBinding,
  type Invitation,
  type Member,
  type SubscriptionOverview,
  type UsageMeter,
  type WorkspaceContext,
} from "@merchant/contracts";

import en from "../messages/en.json";
import id from "../messages/id.json";
import { openAs } from "./sign-in";

// Read-response fixtures only. No invitation, device, retry, PIN, or preference
// is written to the local API. Functional mutation tests remain separate.
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".ui-skeleton")).toHaveCount(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ animations: "disabled", fullPage: true, path });
  await info.attach(name, { contentType: "image/png", path });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    name,
  ).toBeLessThanOrEqual(1);
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, `${name}: detail must not clip its content`).toBeLessThanOrEqual(1);
  }
  const rowPadding = await page
    .locator(".ui-table tbody tr:not(.ui-table__empty) td")
    .evaluateAll((cells) =>
      cells.map((cell) => Number.parseFloat(getComputedStyle(cell).paddingTop)),
    );
  for (const padding of rowPadding)
    expect(padding, `${name}: multiline rows need inner spacing`).toBeGreaterThanOrEqual(8);
  const clippedTables = await page
    .locator(".ui-table")
    .evaluateAll((tables) => tables.map((table) => table.scrollWidth - table.clientWidth));
  for (const overflow of clippedTables)
    expect(overflow, `${name}: table identity, status and action must fit`).toBeLessThanOrEqual(1);
}

const now = "2026-10-18T12:00:00.000Z";
const bindings: IntegrationBinding[] = [
  ["order.canceled.v1", "ACTIVE", "HEALTHY"],
  ["order.submitted.v1", "ERROR", "BLOCKED"],
  ["sale.completed.v1", "ACTIVE", "STALE"],
  ["order.submitted.v1", "PAUSED", "HEALTHY"],
  ["sale.completed.v1", "SETUP_REQUIRED", "BLOCKED"],
  ["order.canceled.v1", "DISABLED", "HEALTHY"],
].map(([eventType, status, health]) => ({
  auditReason: null,
  configSchemaVersion: 1,
  effectiveFrom: now,
  effectiveTo: null,
  eventType: eventType!,
  handlerKey: "audit.visual",
  health: health as IntegrationBinding["health"],
  id: randomUUID(),
  lastError: status === "ERROR" ? "fixture-not-for-display" : null,
  sourceModuleKey: eventType!.startsWith("sale") ? "CORE_BILL" : "CORE_ORDER",
  status: status as IntegrationBinding["status"],
  targetModuleKey: eventType!.startsWith("sale") ? "CUSTOMER_BASIC" : "KDS",
  updatedAt: now,
  workspaceId: randomUUID(),
}));

for (const variant of [
  { width: 320, theme: "dark", locale: "en" },
  { width: 390, theme: "light", locale: "id" },
  { width: 1440, theme: "light", locale: "id" },
  { width: 1440, theme: "dark", locale: "en" },
] as const) {
  test(`M2 conditional details ${variant.width} ${variant.theme} ${variant.locale}`, async ({
    page,
  }, info) => {
    const { width, theme, locale } = variant;
    const text = locale === "id" ? id : en;
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.route("**/api/v1/auth/session", async (route) => {
      const response = await route.fetch();
      const session = await response.json();
      await route.fulfill({
        response,
        json: { ...session, user: { ...session.user, locale, theme } },
      });
    });
    await openAs(page, "catalog.owner@local.test", "/settings/users");
    await page
      .context()
      .addCookies([{ name: "locale", value: locale, url: new URL(page.url()).origin }]);
    // Prevent accidental business writes, including future additions to this audit.
    const writes: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.fallback();
      writes.push(new URL(route.request().url()).pathname);
      await route.abort();
    });

    let member: Member | undefined;
    let memberLoaded!: () => void;
    const memberReady = new Promise<void>((resolve) => {
      memberLoaded = resolve;
    });
    const longEmail = "very.long.invited.person.with.a.long.local.part@example.test";
    await page.route("**/api/v1/access/members", async (route) => {
      const response = await route.fetch();
      const data = (await response.json()) as { members: Member[] };
      member = {
        ...data.members[0]!,
        email: longEmail,
        displayName: "Anggota dengan nama panjang untuk pemeriksaan detail",
      };
      memberLoaded();
      await route.fulfill({ response, json: { members: [member] } });
    });
    await page.route("**/api/v1/access/invitations", async (route) => {
      await memberReady;
      const invitations: Invitation[] = (["PENDING", "EXPIRED", "REVOKED"] as const).map(
        (status, index) => ({
          acceptedAt: null,
          allOutlets: member!.allOutlets,
          createdAt: now,
          email: `invitation.${index}.${longEmail}`,
          expiresAt: status === "PENDING" ? "2099-10-20T12:00:00.000Z" : now,
          id: randomUUID(),
          outletIds: member!.outletIds,
          revokedAt: status === "REVOKED" ? now : null,
          roleIds: member!.roleIds,
          status,
          workspaceId: randomUUID(),
        }),
      );
      await route.fulfill({ json: { invitations } });
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const main = page.getByRole("main");
    const dialog = page.getByRole("dialog");
    await expect(main.locator("tbody tr")).toHaveCount(1);
    await expect(main.locator("tbody .ui-badge:visible")).toHaveCount(1);
    await capture(page, info, "members-long-list");
    await main.locator("tbody tr").first().click();
    await expect(dialog).toBeVisible();
    const details = dialog.locator(".ui-description-list");
    if (width < 768) {
      await expect(details).toBeVisible();
      await expect(details.getByText(longEmail, { exact: true })).toBeVisible();
      await expect(details.getByText(text.users.role, { exact: true })).toBeVisible();
      await expect(details.getByText(text.users.outlets, { exact: true })).toBeVisible();
    } else {
      await expect(details).toBeHidden();
      await expect(main.getByRole("cell", { name: longEmail, exact: true })).toBeVisible();
    }
    await capture(page, info, "member-long-detail");
    await page.keyboard.press("Escape");
    await main.getByRole("tab", { name: text.users.invitations, exact: true }).click();
    await expect(main.locator("tbody tr")).toHaveCount(3);
    await expect(main.locator("tbody .ui-badge:visible")).toHaveCount(3);
    await capture(page, info, "invitations-long-list");
    for (let index = 0; index < 3; index++) {
      await main.locator("tbody tr").nth(index).click();
      await expect(dialog).toBeVisible();
      if (width < 768) await expect(dialog.locator(".ui-description-list")).toBeVisible();
      await capture(page, info, `invitation-state-${index}`);
      await page.keyboard.press("Escape");
    }

    await page.route("**/api/v1/modules/bindings", (route) =>
      route.fulfill({ json: { bindings } }),
    );
    await page.goto("/settings/integrations");
    await expect(main.locator("tbody tr")).toHaveCount(5);
    await expect(main.locator("tbody tr").first().getByRole("cell").first()).toContainText(
      text.integrations.eventName.orderCanceled,
    );
    await expect(main.locator("tbody tr").nth(1).getByRole("cell").first()).toContainText(
      text.integrations.eventName.orderSubmitted,
    );
    for (const state of ["ACTIVE", "FAILED", "PAUSED", "PROCESSING", "SETUP_REQUIRED"] as const) {
      await expect(main.getByText(text.integrations.state[state], { exact: true })).toBeVisible();
    }
    await expect(
      main.getByRole("button", { name: text.integrations.retry, exact: true }),
    ).toHaveCount(1);
    await expect(main).not.toContainText("CORE_ORDER");
    await expect(main).not.toContainText("CORE_BILL");
    await expect(main).not.toContainText("fixture-not-for-display");
    await capture(page, info, "integrations-mixed-states");
    await page.route("**/api/v1/modules/bindings", (route) =>
      route.fulfill({ json: { bindings: bindings.slice(0, 1) } }),
    );
    await page.reload();
    await expect(main.locator("tbody tr")).toHaveCount(1);
    await expect(
      main.getByRole("columnheader", { name: text.integrations.note, exact: true }),
    ).toHaveCount(0);
    await expect(
      main.getByRole("button", { name: text.integrations.retry, exact: true }),
    ).toHaveCount(0);
    await capture(page, info, "integrations-active-only");
    await page.route("**/api/v1/modules/bindings", (route) =>
      route.fulfill({ json: { bindings: [] } }),
    );
    await page.reload();
    await expect(main.getByText(text.integrations.emptyTitle, { exact: true })).toBeVisible();
    await capture(page, info, "integrations-empty");

    await page.route("**/api/v1/subscription", async (route) => {
      const response = await route.fetch();
      const overview = (await response.json()) as SubscriptionOverview;
      const dimensions = [
        "core.business_units.active",
        "core.locations.active",
        "core.users.active",
        "core.roles.custom",
      ];
      const meters: UsageMeter[] = (["OK", "NEAR", "REACHED", "OVER"] as const).map(
        (state, index) => ({
          dimensionKey: dimensions[index]!,
          enforcement: "HARD_COUNT",
          limit: "10",
          periodEnd: null,
          periodStart: null,
          state,
          unit: "count",
          unlimited: false,
          used: ["2", "8", "10", "12"][index]!,
        }),
      );
      await route.fulfill({ response, json: { ...overview, meters } });
    });
    await page.goto("/settings/subscription");
    await expect(main.getByRole("meter")).toHaveCount(4);
    await capture(page, info, "subscription-usage-states");
    await page.route("**/api/v1/subscription", (route) =>
      route.fulfill({ json: { meters: [], modules: [], subscription: null } }),
    );
    await page.reload();
    await expect(
      main.getByText(text.subscription.noSubscriptionTitle, { exact: true }),
    ).toBeVisible();
    await capture(page, info, "subscription-none");

    // The same read data must remain reachable without management actions.
    // This only changes the browser's permission projection, not the account.
    await page.route("**/api/v1/access/workspaces", async (route) => {
      const response = await route.fetch();
      const workspaces = (await response.json()) as WorkspaceContext[];
      await route.fulfill({
        response,
        json: workspaces.map((workspace) => ({
          ...workspace,
          permissionKeys: workspace.permissionKeys.filter(
            (permission) =>
              permission !== PERMISSIONS.deviceManage &&
              permission !== PERMISSIONS.organizationManage,
          ),
        })),
      });
    });
    await page.goto("/settings/devices");
    await expect(main.locator("tbody tr").first()).toBeVisible();
    await expect(main.locator(".ui-page-header__actions button")).toHaveCount(0);
    await main
      .locator("tbody tr")
      .filter({ has: page.getByText(text.devices.statusName.ACTIVE, { exact: true }) })
      .first()
      .click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button")).toHaveCount(1); // Close only.
    if (width < 768) await expect(dialog.locator(".ui-description-list")).toBeVisible();
    await capture(page, info, "device-read-only-detail");
    await page.keyboard.press("Escape");
    await page.route("**/api/v1/modules/bindings", (route) =>
      route.fulfill({ json: { bindings } }),
    );
    await page.goto("/settings/integrations");
    await expect(main.locator("tbody tr")).toHaveCount(5);
    await expect(
      main.getByRole("button", { name: text.integrations.retry, exact: true }),
    ).toHaveCount(0);
    await capture(page, info, "integrations-read-only");

    // Public pages: fake preview only, never create/accept a real invitation.
    await page.route("**/api/v1/device/current", (route) =>
      route.fulfill({
        status: 401,
        json: { code: "UNAUTHORIZED", message: "No device", requestId: "visual-only" },
      }),
    );
    await page.goto("/activate");
    await expect(page.getByLabel(text.activate.code, { exact: true })).toBeVisible();
    await capture(page, info, "activation-form");
    for (const accountExists of [false, true]) {
      await page.route("**/api/v1/invitations/preview", (route) =>
        route.fulfill({
          json: {
            accountExists,
            email: longEmail,
            expiresAt: "2099-10-20T12:00:00.000Z",
            workspaceName: "Kedai dengan nama panjang untuk pemeriksaan undangan",
          },
        }),
      );
      await page.goto(`/invite#token=${(accountExists ? "b" : "a").repeat(43)}`);
      await expect(
        page.getByRole("heading", { name: text.invite.title, exact: true }),
      ).toBeVisible();
      await expect(page.locator("#invite-name")).toHaveCount(accountExists ? 0 : 1);
      await capture(page, info, `invitation-accept-${accountExists ? "existing" : "new"}`);
    }
    expect(writes, "the visual audit must not mutate development data").toEqual([]);
  });
}
