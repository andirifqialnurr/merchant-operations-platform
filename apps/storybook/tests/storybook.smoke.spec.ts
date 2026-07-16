import { test, expect } from "@playwright/test";

test("renders the foundation AppIcon story", async ({ page }) => {
  await page.goto("/iframe.html?id=foundation-appicon--default&viewMode=story");

  await expect(page.getByRole("img", { name: "Merchant outlet" })).toBeVisible();
});
