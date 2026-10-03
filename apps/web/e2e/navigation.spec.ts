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
  expect(await menu(page)).toEqual(["Katalog", "Kasir"]);
  await expect(page.getByRole("link", { name: "Katalog" })).toHaveAttribute("aria-current", "page");
});

test("a manager assigned to one outlet gets the same modules", async ({ page }) => {
  await openAs(page, "pos.manager@local.test", "/catalog");
  expect(await menu(page)).toEqual(["Katalog", "Kasir"]);
});
