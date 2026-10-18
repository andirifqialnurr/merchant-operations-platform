import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { openAs } from "./sign-in";

// Evidence for human review, not a self-approved screenshot baseline. Run against
// the local stack; no form is submitted and account preferences are not changed.
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".ui-skeleton")).toHaveCount(0);
  await expect(main.locator(".ui-panel").first()).toBeVisible();
  await expect(main.locator(".ui-panel .ui-panel")).toHaveCount(0);
  const rowPadding = await main
    .locator(".ui-table tbody tr:not(.ui-table__empty) td")
    .evaluateAll((cells) =>
      cells.map((cell) => Number.parseFloat(getComputedStyle(cell).paddingTop)),
    );
  for (const padding of rowPadding)
    expect(padding, `${name}: multiline rows need inner spacing`).toBeGreaterThanOrEqual(8);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: page must not scroll horizontally`).toBeLessThanOrEqual(1);
  // A long option label must not push a field past the edge of its sheet.
  const clipped = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const edge = dialog.getBoundingClientRect().right;
    return [...dialog.querySelectorAll("input, textarea, button")]
      .filter((field) => field.getBoundingClientRect().right > edge + 1)
      .map((field) => field.getAttribute("id") ?? field.textContent ?? field.tagName);
  });
  expect(clipped, `${name}: fields must fit inside the sheet`).toEqual([]);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ animations: "disabled", fullPage: true, path });
  await info.attach(name, { contentType: "image/png", path });
}

for (const width of [320, 390, 767, 768, 1279, 1280, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    for (const locale of ["id", "en"] as const) {
      test(`settings visual ${width}px ${theme} ${locale}`, async ({ page }, info) => {
        await page.setViewportSize({ height: 900, width });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        // Override preferences only in this browser's read response. The server
        // account and the other E2E suites keep their original preferences.
        await page.route("**/api/v1/auth/session", async (route) => {
          const response = await route.fetch();
          if (!response.ok()) return route.fulfill({ response });
          const session = await response.json();
          await route.fulfill({
            response,
            json: { ...session, user: { ...session.user, locale, theme } },
          });
        });
        await openAs(page, "catalog.owner@local.test", "/settings/organization");
        // openAs may restore a saved locale cookie. Set the requested locale
        // after loading that session, then verify the actual rendered preference.
        await page
          .context()
          .addCookies([{ name: "locale", value: locale, url: new URL(page.url()).origin }]);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const name = page.getByLabel(locale === "id" ? "Nama bisnis" : "Business name");
        await expect(name).toBeVisible();
        const spacing = await name.evaluate((input) => {
          const form = input.closest("form")!;
          const panel = form.closest(".ui-panel")!;
          const field = input.closest(".ui-form-field") ?? input;
          const panelBox = panel.getBoundingClientRect();
          const fieldBox = field.getBoundingClientRect();
          const style = getComputedStyle(form);
          return {
            gap: Number.parseFloat(style.rowGap),
            left: fieldBox.left - panelBox.left,
            padding: Number.parseFloat(style.paddingTop),
            right: panelBox.right - fieldBox.right,
          };
        });
        expect(spacing.padding, "business form needs 16px inner padding").toBeGreaterThanOrEqual(
          16,
        );
        expect(spacing.left).toBeGreaterThanOrEqual(16);
        expect(spacing.right).toBeGreaterThanOrEqual(16);
        expect(spacing.gap, "fields need 16px separation").toBeGreaterThanOrEqual(16);
        await capture(page, info, "organization-business");

        for (const tab of ["brands", "outlets"]) {
          await page.goto(`/settings/organization?tab=${tab}`);
          await expect(page.getByRole("main").getByRole("table")).toBeVisible();
          await capture(page, info, `organization-${tab}`);
          await page.goto(`/settings/organization?tab=${tab}&id=new`);
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture(page, info, `organization-${tab}-form`);
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toBeHidden();
        }
        for (const section of ["users", "roles", "devices", "subscription", "integrations"]) {
          await page.goto(`/settings/${section}`);
          await capture(page, info, section);
          const main = page.getByRole("main");
          const dialog = page.getByRole("dialog");
          if (section === "users" || section === "roles" || section === "devices") {
            await main.locator("tbody tr").first().click();
            await expect(dialog).toBeVisible();
            if (section !== "roles") {
              if (width < 768) await expect(dialog.locator(".ui-description-list")).toBeVisible();
              else await expect(dialog.locator(".ui-description-list")).toBeHidden();
            }
            await capture(page, info, `${section}-detail`);
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            await main.locator(".ui-page-header__actions button").click();
            await expect(dialog).toBeVisible();
            if (section === "users") {
              await expect(
                dialog.getByText(locale === "id" ? "Peran" : "Role", { exact: true }),
              ).toBeVisible();
            }
            if (section === "devices") {
              for (const label of locale === "id" ? ["Jenis", "Outlet"] : ["Type", "Outlet"]) {
                await expect(dialog.getByText(label, { exact: true })).toBeVisible();
              }
            }
            await capture(page, info, `${section}-form`);
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
          }
          if (section === "users") {
            await main
              .getByRole("tab", { name: locale === "id" ? "Undangan" : "Invitations" })
              .click();
            await capture(page, info, "users-invitations");
          }
          if (section === "roles") {
            await main
              .getByRole("tab", { name: locale === "id" ? "Perbandingan" : "Comparison" })
              .click();
            await expect(main.locator(".ui-permission-matrix")).toBeVisible();
            await capture(page, info, "roles-comparison");
            // Scrolling must not take the permission names out of view.
            const matrix = main.locator(".ui-permission-matrix");
            await matrix.focus();
            await matrix.evaluate((element) => {
              element.scrollLeft = element.scrollWidth;
            });
            await capture(page, info, "roles-comparison-scrolled");
          }
        }
        await page
          .getByRole("button", {
            name: locale === "id" ? "Menu akun" : "Account menu",
            exact: true,
          })
          .click();
        await capture(page, info, "account-preferences");
        await page.getByRole("button", { name: /PIN/ }).click();
        await expect(
          page.getByRole("dialog", {
            name: locale === "id" ? "Menu akun" : "Account menu",
            exact: true,
          }),
        ).toBeHidden();
        await expect(page.getByRole("dialog")).toBeVisible();
        await capture(page, info, "approval-pin");
        await page.keyboard.press("Escape");
      });
    }
  }
}
