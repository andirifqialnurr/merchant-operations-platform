import { expect, test } from "@playwright/test";

import { openAs } from "./sign-in";

test("organization tabs and details survive reload and forms show missing fields", async ({
  page,
}) => {
  await openAs(page, "catalog.owner@local.test", "/settings/organization");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Bisnis dan outlet" })).toBeVisible();
  await expect(main.getByRole("textbox")).toHaveCount(1);
  await expect(main.getByRole("button", { name: "Simpan" })).toBeEnabled();
  await expect(main.getByText("Mata uang", { exact: true })).toBeVisible();
  await main.getByLabel("Nama bisnis").fill(" ");
  await main.getByRole("button", { name: "Simpan" }).click();
  await expect(main.getByText("Isi nama minimal 2 huruf atau angka.")).toBeVisible();

  await page.getByRole("tab", { name: "Brand", exact: true }).click();
  await page.getByRole("button", { name: "Tambah brand" }).click();
  await expect(page).toHaveURL(/tab=brands&id=new$/);
  await page.reload();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Brand baru" })).toBeVisible();
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(sheet.getByText("Isi nama minimal 2 huruf atau angka.")).toBeVisible();
  await expect(sheet.getByRole("textbox")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/tab=brands$/);
  await expect(sheet).toBeHidden();

  const outletsTab = page.getByRole("tab", { name: "Outlet", exact: true });
  await outletsTab.click();
  await expect(page).toHaveURL(/tab=outlets$/);
  await expect(outletsTab).toHaveAttribute("aria-selected", "true");
  // A saved outlet is opened with the keyboard and has its ID in the URL.
  // Scope to the destination table so an old brand row cannot satisfy this locator.
  const outletsTable = main.getByRole("table", { name: "Outlet", exact: true });
  await expect(outletsTable).toBeVisible();
  const row = outletsTable.getByRole("row").nth(1);
  await row.focus();
  await expect(row).toBeFocused();
  await row.press("Enter");
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/tab=outlets&id=[\da-f-]+$/);
  await page.reload();
  await expect(sheet.getByLabel("Nama outlet")).toBeVisible();
  await expect(sheet.getByRole("textbox")).toHaveCount(2);
  // Select uses a button that opens a listbox; Combobox is a separate component.
  for (const label of ["Brand", "Zona waktu"]) {
    const select = sheet.getByLabel(label, { exact: true }).getByRole("button");
    await expect(select).toBeVisible();
    await expect(select).toBeEnabled();
    await expect(select).toHaveAttribute("aria-haspopup", "listbox");
  }
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/tab=outlets$/);
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Tambah outlet" }).click();
  await expect(page).toHaveURL(/tab=outlets&id=new$/);
  await expect(sheet.getByRole("heading", { name: "Outlet baru" })).toBeVisible();
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(sheet.getByText("Isi nama minimal 2 huruf atau angka.")).toBeVisible();
  await sheet.getByLabel("Alamat").fill("x");
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(sheet.getByText("Alamat terlalu pendek.")).toBeVisible();
});

test("outlet-scoped staff cannot read or change the organization", async ({ page }) => {
  await openAs(page, "pos.manager@local.test", "/settings/organization");
  await expect(
    page.getByRole("heading", { name: "Anda tidak punya akses ke halaman ini" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bisnis dan outlet" })).toHaveCount(0);
});

test("a brand reactivation refused by the package limit shows the recovery state", async ({
  page,
}) => {
  const brandId = "019a0000-0000-7000-8000-000000000001";
  // Keep the real login/workspace checks, but provide an inactive row and a full limit.
  await page.route("**/api/v1/organization", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    await route.fulfill({
      response,
      json: {
        ...snapshot,
        brands: [
          {
            createdAt: snapshot.tenant.createdAt,
            id: brandId,
            name: "Brand uji batas",
            slug: "brand-uji-batas",
            status: "INACTIVE",
            tenantId: snapshot.tenant.id,
            updatedAt: snapshot.tenant.updatedAt,
          },
        ],
      },
    });
  });
  await page.route(`**/api/v1/organization/brands/${brandId}`, (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: "LIMIT_REACHED",
        message: "Limit reached",
        requestId: "e2e_organization_limit",
        details: { dimensionKey: "core.business_units.active", limit: "1", usage: "1" },
      },
    }),
  );
  await openAs(page, "catalog.owner@local.test", "/settings/organization?tab=brands");
  await page.getByRole("row", { name: /Brand uji batas/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Aktifkan", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Lihat langganan" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Simpan" })).toHaveCount(0);
});
