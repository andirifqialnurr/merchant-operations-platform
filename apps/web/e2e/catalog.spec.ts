import { expect, type Page, test } from "@playwright/test";

import { openAs } from "./sign-in";

// Names are unique per run so the test can be repeated on the same database.
const run = Date.now().toString(36);
const CATEGORY = `Uji Kategori ${run}`;
const MODIFIER = `Uji Level ${run}`;
const PRODUCT = `Uji Produk ${run}`;

function sheet(page: Page) {
  return page.getByRole("dialog");
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click();
}

/** Opens the row of a record in the list that is showing. */
async function openRow(page: Page, name: string) {
  await page.getByRole("row", { name: new RegExp(name) }).click();
  await expect(sheet(page)).toBeVisible();
}

/** Picks a language in the account menu, then closes the menu. */
async function setLanguage(page: Page, label: "English" | "Indonesia") {
  const choice = page.getByText(label, { exact: true });
  if (!(await choice.isVisible())) {
    await page.getByRole("button", { name: /^(Menu akun|Account menu)$/ }).click();
  }
  await choice.click();
  await page.keyboard.press("Escape");
}

test.describe.configure({ mode: "serial" });

test("an owner adds a category, a modifier, and a product sold at the outlet", async ({ page }) => {
  await openAs(page, "catalog.owner@local.test", "/catalog");
  // An interrupted earlier run may have left the account in English.
  await setLanguage(page, "Indonesia");
  await expect(page.getByRole("heading", { level: 1, name: "Katalog" })).toBeVisible();

  await openTab(page, "Kategori");
  await page.getByRole("button", { name: "Tambah kategori" }).click();
  await sheet(page).getByLabel("Nama kategori").fill(CATEGORY);
  await sheet(page).getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Kategori ditambahkan.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(CATEGORY) })).toBeVisible();

  await openTab(page, "Modifier");
  await page.getByRole("button", { name: "Tambah modifier" }).click();
  await sheet(page).getByLabel("Nama modifier").fill(MODIFIER);
  await sheet(page).getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Modifier ditambahkan.")).toBeVisible();
  // Saving closes the sheet; the choices are added on the saved modifier.
  await expect(sheet(page)).toBeHidden();
  await openRow(page, MODIFIER);
  for (const option of ["Normal", "Pedas"]) {
    await sheet(page).getByLabel("Nama pilihan").fill(option);
    await sheet(page).getByRole("button", { exact: true, name: "Tambah" }).click();
    await expect(sheet(page).getByText(option, { exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");

  await openTab(page, "Produk");
  await page.getByRole("button", { name: "Tambah produk" }).click();
  await sheet(page).getByLabel("Nama produk").fill(PRODUCT);
  await sheet(page).getByLabel("Kategori").click();
  await page.getByRole("option", { name: CATEGORY }).click();
  await sheet(page).getByLabel("Harga", { exact: true }).fill("18000");
  await sheet(page).getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Produk ditambahkan.")).toBeVisible();
  await expect(sheet(page)).toBeHidden();
  await page.getByPlaceholder("Cari produk").fill(PRODUCT);
  await openRow(page, PRODUCT);

  await sheet(page).getByLabel("Nama varian").fill("Besar");
  await sheet(page).getByLabel("Tambahan harga").fill("4000");
  await sheet(page).getByRole("button", { exact: true, name: "Tambah" }).click();
  await expect(sheet(page).getByText("Besar", { exact: true })).toBeVisible();
  await expect(sheet(page).getByText("+Rp4.000")).toBeVisible();

  await sheet(page).getByLabel("Modifier").click();
  await page.getByRole("option", { name: MODIFIER }).click();
  await sheet(page).getByRole("button", { name: "Pasang" }).click();
  await expect(sheet(page).getByRole("button", { name: "Lepas" })).toBeVisible();

  const sold = sheet(page).getByLabel("Dijual di outlet ini");
  // The input sits under its drawn track, so the label is what a person clicks.
  await sheet(page).getByText("Dijual di outlet ini").click();
  await expect(page.getByText("Pengaturan outlet diperbarui.").first()).toBeVisible();
  await expect(sold).toBeChecked();
  await expect(sheet(page).getByLabel("Habis di outlet ini")).toBeVisible();
});

test("the catalog reads the same in English and in the dark theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openAs(page, "catalog.owner@local.test", "/catalog");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  try {
    await setLanguage(page, "English");
    await expect(page.getByRole("heading", { level: 1, name: "Catalog" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Modifiers" })).toBeVisible();
    await page.getByRole("textbox", { name: "Search products" }).fill(PRODUCT);
    await openRow(page, PRODUCT);
    await expect(sheet(page).getByLabel("Sold at this outlet")).toBeChecked();
    await page.keyboard.press("Escape");
  } finally {
    // The choice is saved on the account, so it is put back for later runs.
    await setLanguage(page, "Indonesia");
  }
  await expect(page.getByRole("heading", { level: 1, name: "Katalog" })).toBeVisible();
});

test("an outlet-scoped manager sees only what their outlet sells", async ({ page }) => {
  await openAs(page, "pos.manager@local.test", "/catalog");
  await expect(page.getByRole("heading", { level: 1, name: "Katalog" })).toBeVisible();

  // Without access to every outlet there is no master catalog: no tabs, nothing to add.
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tambah produk" })).toHaveCount(0);
  await expect(page.getByRole("banner").getByText("Kopi Lokal Pusat")).toBeVisible();

  await expect(page.getByRole("row", { name: new RegExp(PRODUCT + ".*Rp18.000") })).toBeVisible();
  await openRow(page, PRODUCT);
  await expect(sheet(page).getByLabel("Habis di outlet ini")).not.toBeChecked();
});
