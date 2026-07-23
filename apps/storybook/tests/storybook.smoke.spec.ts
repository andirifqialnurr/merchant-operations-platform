import { test, expect } from "@playwright/test";

test("renders the foundation AppIcon story", async ({ page }) => {
  await page.goto("/iframe.html?id=foundation-appicon--default&viewMode=story");

  await expect(page.getByRole("img", { name: "Merchant outlet" })).toBeVisible();
});

test("renders the story contract states", async ({ page }) => {
  await page.goto("/iframe.html?id=foundation-story-contract--template&viewMode=story");

  await expect(page.getByRole("button", { name: "Default" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Menyimpan perubahan..." })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Perubahan belum tersimpan");
});

test("renders the Button contract story", async ({ page }) => {
  await page.goto("/iframe.html?id=primitives-button--states&viewMode=story");

  await expect(page.getByRole("button", { name: "Simpan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Menyimpan perubahan..." })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hapus produk" })).toBeVisible();
});

test("validates the POS modifier picker interaction and mobile reflow", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    "/iframe.html?id=domain-pos-modifier-picker--required-and-optional-groups&viewMode=story",
  );

  const dialog = page.getByRole("dialog", { name: "Sesuaikan pesanan" });
  const submit = page.getByRole("button", { name: "Tambahkan ke keranjang" });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Belum lengkap")).toHaveCount(2);
  await expect(submit).toBeDisabled();

  await page.getByRole("radio", { name: "Regular" }).press("Space");
  await page.getByRole("radio", { name: "Normal" }).press("Space");
  await expect(submit).toBeEnabled();

  await page.getByRole("checkbox", { name: /Extra espresso shot/ }).press("Space");
  await page.getByRole("checkbox", { name: /Coffee jelly/ }).press("Space");
  await expect(page.getByRole("checkbox", { name: /Whipped cream/ })).toBeDisabled();

  const note = page.getByRole("textbox", { name: "Catatan item" });
  await note.fill("Es sedikit, tanpa sedotan");
  await expect(note).toHaveValue("Es sedikit, tanpa sedotan");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates the POS cart detail, quantity, and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-pos-cart--mobile-reflow&viewMode=story");

  const item = page.getByRole("article");
  await expect(item).toBeVisible();
  await expect(page.getByText(/Oat milk dengan nama modifier panjang/)).toHaveCount(0);
  await page.getByRole("button", { name: "Lihat detail (+2)" }).click();
  await expect(page.getByText(/Oat milk dengan nama modifier panjang/)).toBeVisible();

  await page.getByRole("button", { name: /Tambah Es kopi susu gula aren signature/ }).click();
  await expect(item.getByText("Rp105.000")).toBeVisible();
  await expect(page.getByRole("region", { name: "Ringkasan keranjang" })).toContainText("Rp75.900");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Money Display states, exact values, and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-shared-money-display--mobile-reflow&viewMode=story");

  await expect(page.getByText("Rp900.719.925.474.099.312.345")).toBeVisible();
  await expect(page.getByText("Total belum tersedia")).toBeAttached();
  await expect(page.locator(".ui-money-display--unavailable")).toHaveText("-Total belum tersedia");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates payment selection, cash presets, keypad targets, and mobile reflow", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-pos-payment--mobile-reflow&viewMode=story");

  await expect(page.getByRole("radio", { name: /Tunai/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Kartu EDC/ })).toBeDisabled();
  const numericKeys = page.getByRole("group", { name: "Angka nominal tunai" }).getByRole("button");
  await expect
    .poll(async () =>
      Math.min(
        ...(await numericKeys.evaluateAll((keys) =>
          keys.map((key) => key.getBoundingClientRect().height),
        )),
      ),
    )
    .toBeGreaterThanOrEqual(56);

  await page.getByRole("button", { name: "Rp80.000" }).click();
  await expect(page.getByText("Rp4.100")).toBeVisible();
  await page.getByRole("radio", { name: /QRIS merchant/ }).check();
  await expect(page.getByRole("region", { name: "Keypad pembayaran tunai" })).toHaveCount(0);
  await expect(page.getByText("Keypad tunai tidak digunakan untuk metode QRIS.")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
