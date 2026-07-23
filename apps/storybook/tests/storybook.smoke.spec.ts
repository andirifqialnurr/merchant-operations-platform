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
