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
  expect(await menu(page)).toEqual(["Katalog", "Kasir", "Langganan"]);
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
