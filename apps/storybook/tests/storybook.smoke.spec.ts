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
