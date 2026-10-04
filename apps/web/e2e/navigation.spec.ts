import { expect, type Page, test } from "@playwright/test";

import { openAs } from "./sign-in";

/** Names of the links in the backoffice sidebar, in order. */
async function menu(page: Page) {
  const navigation = page.getByRole("navigation", { name: "Navigasi utama" });
  await expect(navigation.getByRole("link").first()).toBeVisible();
  return navigation.getByRole("link").allInnerTexts();
}

test("the owner's menu lists the installed modules they may open", async ({ page }) => {
  await openAs(page, "catalog.owner@local.test", "/catalog");
  // Daily modules first, settings last.
  expect(await menu(page)).toEqual([
    "Katalog",
    "Kasir",
    "Perangkat",
    "Pengguna",
    "Peran",
    "Langganan",
  ]);
  await expect(page.getByRole("link", { name: "Katalog" })).toHaveAttribute("aria-current", "page");
});

test("a manager assigned to one outlet gets the same modules", async ({ page }) => {
  await openAs(page, "pos.manager@local.test", "/catalog");
  expect(await menu(page)).toEqual(["Katalog", "Kasir"]);
});

test("the owner reads the package, its modules, and usage on the subscription page", async ({
  page,
}) => {
  await openAs(page, "catalog.owner@local.test", "/settings/subscription");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Langganan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Langganan" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const section of ["Paket", "Modul", "Pemakaian"]) {
    await expect(main.getByRole("heading", { level: 2, name: section })).toBeVisible();
  }
  // The cashier module is part of the package, named in the reader's language.
  await expect(main.getByText("Kasir", { exact: true })).toBeVisible();
  // Reading only: the page offers nothing to change.
  await expect(main.getByRole("button")).toHaveCount(0);
  await expect(main.getByRole("textbox")).toHaveCount(0);
});

test("a cashier is told the subscription is not theirs to see", async ({ page }) => {
  await openAs(page, "pos.cashier@local.test", "/settings/subscription");
  await expect(page.getByRole("heading", { name: "Anda tidak punya akses" })).toBeVisible();
  await expect(page.getByRole("meter")).toHaveCount(0);
});

test("the owner opens the devices page and the form says what is missing", async ({ page }) => {
  await openAs(page, "catalog.owner@local.test", "/settings/devices");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Perangkat" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Perangkat" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // One primary action on the page.
  await expect(main.getByRole("button")).toHaveCount(1);

  await main.getByRole("button", { name: "Daftarkan perangkat" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Daftarkan" }).click();
  await expect(sheet.getByText("Isi nama perangkat, minimal 2 karakter.")).toBeVisible();
  // Nothing was registered and no code is shown.
  await expect(sheet.getByLabel("Kode aktivasi")).toHaveCount(0);
});

test("a cashier is told the devices are not theirs to manage", async ({ page }) => {
  await openAs(page, "pos.cashier@local.test", "/settings/devices");
  await expect(page.getByRole("heading", { name: "Anda tidak punya akses" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Daftarkan perangkat" })).toHaveCount(0);
});

test("a device that is not activated yet is asked for its code, without signing in", async ({
  page,
}) => {
  await page.goto("/activate");
  await expect(page.getByRole("heading", { level: 1, name: "Aktifkan perangkat" })).toBeVisible();
  // No sign-in is asked for and no cashier screen is offered before activation.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buka kasir" })).toHaveCount(0);

  // A code of the wrong shape is caught on the device, before any request.
  await page.getByLabel("Kode aktivasi").fill("abc");
  await page.getByRole("button", { name: "Aktifkan" }).click();
  await expect(page.getByText("Kode terdiri dari 8 huruf dan angka.")).toBeVisible();
  await expect(page.getByLabel("Kode aktivasi")).toHaveValue("ABC");
});

test("an invitation link without a usable secret says so and asks for nothing", async ({
  page,
}) => {
  // No secret at all.
  await page.goto("/invite");
  await expect(page.getByRole("heading", { name: "Undangan tidak dapat dibuka" })).toBeVisible();
  await expect(page.getByText("Tautan undangan ini tidak lengkap.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  // A well-formed secret that no invitation holds.
  await page.goto(`/invite#token=${"w".repeat(43)}`);
  await expect(page.getByText("Tautan undangan ini salah atau sudah tidak berlaku.")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  // The secret leaves the address once it was read.
  await expect(page).toHaveURL(/\/invite$/);
});

test("the owner sees the people of the business and the invite form says what is missing", async ({
  page,
}) => {
  await openAs(page, "catalog.owner@local.test", "/settings/users");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Pengguna" })).toBeVisible();
  const own = main.getByRole("row", { name: /catalog\.owner@local\.test/ });
  await expect(own).toContainText("Pemilik");
  await expect(own).toContainText("Semua outlet");
  // One primary action on the page.
  await expect(main.getByRole("button")).toHaveCount(1);

  // Nobody can take away their own access: the row offers no action.
  await own.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Ini akun Anda sendiri.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Cabut akses" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await main.getByRole("button", { name: "Undang pengguna" }).click();
  await sheet.getByRole("button", { name: "Kirim undangan" }).click();
  await expect(sheet.getByText("Isi alamat email yang benar.")).toBeVisible();
  await expect(sheet.getByText("Pilih peran.")).toBeVisible();
  // A message goes away once the field is worked on.
  await sheet.getByLabel("Email").fill("seseorang@example.com");
  await expect(sheet.getByText("Isi alamat email yang benar.")).toHaveCount(0);
});

test("a cashier is told the people page is not theirs to open", async ({ page }) => {
  await openAs(page, "pos.cashier@local.test", "/settings/users");
  await expect(page.getByRole("heading", { name: "Anda tidak punya akses" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("the owner reads what each role may do, in plain words, and built-in roles stay as they are", async ({
  page,
}) => {
  await openAs(page, "catalog.owner@local.test", "/settings/roles");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Peran" })).toBeVisible();
  // One primary action on the page.
  await expect(main.getByRole("button")).toHaveCount(1);

  await main.getByRole("row", { name: /^Kasir/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Peran bawaan sama di semua bisnis")).toBeVisible();
  await expect(sheet.getByLabel("Membuat pesanan")).toBeChecked();
  await expect(sheet.getByLabel("Mengubah produk, kategori, dan harga")).not.toBeChecked();
  // Nothing in a built-in role can be changed or saved.
  await expect(sheet.getByLabel("Membuat pesanan")).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Simpan" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await main.getByRole("button", { name: "Buat peran" }).click();
  await sheet.getByRole("button", { name: "Simpan" }).click();
  await expect(sheet.getByText("Pilih minimal satu izin.")).toBeVisible();
});
