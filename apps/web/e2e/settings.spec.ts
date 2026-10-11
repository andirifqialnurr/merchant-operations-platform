import { expect, type Page, test } from "@playwright/test";

import { openAs } from "./sign-in";

const SETTINGS = ["Bisnis dan outlet", "Perangkat", "Integrasi", "Pengguna", "Peran", "Langganan"];

test("settings sit in their own group, one page per part, and /settings opens the first", async ({
  page,
}) => {
  await openAs(page, "catalog.owner@local.test", "/settings");
  // "/settings" has no page of its own.
  await expect(page).toHaveURL(/\/settings\/organization$/);

  const group = page.getByRole("navigation", { name: "Pengaturan" });
  await expect(group.getByRole("link")).toHaveText(SETTINGS);
  // Daily work stays in the main menu, without any settings in it.
  const daily = page.getByRole("navigation", { name: "Navigasi utama" });
  await expect(daily.getByRole("link")).toHaveText(["Katalog", "Kasir"]);

  // Every part is a page of its own with its own title.
  for (const name of SETTINGS) {
    await group.getByRole("link", { exact: true, name }).click();
    await expect(page.getByRole("main").getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(group.getByRole("link", { exact: true, name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

test("a cashier has no settings group and is told so on /settings", async ({ page }) => {
  await openAs(page, "pos.cashier@local.test", "/settings");
  await expect(
    page.getByRole("heading", { name: "Anda tidak punya akses ke pengaturan" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pengaturan" })).toHaveCount(0);
});

/** Answers the next create request as the API does when the package is full. */
async function packageIsFull(page: Page, path: string, dimensionKey: string) {
  await page.route(`**/api/v1${path}`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      json: {
        code: "LIMIT_REACHED",
        details: { dimensionKey, limit: "3", usage: "3" },
        message: "The limit of the package is reached.",
        requestId: "e2e-limit",
      },
      status: 403,
    });
  });
}

async function expectLimitExplained(page: Page) {
  const sheet = page.getByRole("dialog");
  // Not a generic error: what is full, how much is used, and where to go next.
  await expect(sheet.getByText("Batas paket tercapai")).toBeVisible();
  await expect(sheet.getByRole("meter")).toBeVisible();
  await expect(sheet.getByText("3 dari 3")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Lihat langganan" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^(Simpan|Kirim undangan)$/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
}

test("a full package is explained where a brand, outlet, person, or role is added", async ({
  page,
}) => {
  await packageIsFull(page, "/organization/brands", "core.business_units.active");
  await packageIsFull(page, "/organization/outlets", "core.locations.active");
  await packageIsFull(page, "/access/invitations", "core.users.active");
  await packageIsFull(page, "/access/roles", "core.roles.custom");
  const sheet = page.getByRole("dialog");

  await openAs(page, "catalog.owner@local.test", "/settings/organization?tab=brands&id=new");
  await sheet.getByLabel("Nama brand").fill("Brand Penuh");
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expectLimitExplained(page);

  await page.goto("/settings/organization?tab=outlets&id=new");
  await sheet.getByLabel("Nama outlet").fill("Outlet Penuh");
  const brand = sheet.getByLabel("Brand", { exact: true }).getByRole("button");
  if ((await brand.innerText()).includes("Pilih brand")) {
    await brand.click();
    await page.getByRole("option").first().click();
  }
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expectLimitExplained(page);

  await page.goto("/settings/users");
  await page.getByRole("main").getByRole("button", { name: "Undang pengguna" }).click();
  await sheet.getByLabel("Email").fill("penuh@example.com");
  await sheet.getByLabel("Peran").click();
  await page.getByRole("option", { name: "Kasir" }).click();
  await sheet.getByText("Semua outlet", { exact: true }).click();
  await sheet.getByRole("button", { name: "Kirim undangan" }).click();
  await expectLimitExplained(page);

  await page.goto("/settings/roles");
  await page.getByRole("main").getByRole("button", { name: "Buat peran" }).click();
  await sheet.getByLabel("Nama peran").fill("Peran Penuh");
  await sheet.getByText("Membuat pesanan", { exact: true }).click();
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expectLimitExplained(page);
});

test("outlets for a new person are picked from a list, and Escape closes only the list", async ({
  page,
}) => {
  // Nothing is sent: the form is filled in and left.
  await openAs(page, "catalog.owner@local.test", "/settings/users");
  await page.getByRole("main").getByRole("button", { name: "Undang pengguna" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Email").fill("seseorang@example.com");

  const outlets = sheet.getByLabel("Outlet", { exact: true }).getByRole("button");
  await expect(outlets).toHaveText("Pilih outlet");
  await outlets.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(outlets).toHaveText("Kopi Lokal Pusat, Kopi Lokal Timur");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  // The sheet and what was typed in it are still there.
  await expect(sheet.getByLabel("Email")).toHaveValue("seseorang@example.com");
  await expect(outlets).toBeFocused();

  // Everybody at every outlet: the list is not needed and goes away.
  await sheet.getByText("Semua outlet", { exact: true }).click();
  await expect(sheet.getByLabel("Outlet", { exact: true })).toHaveCount(0);
});
