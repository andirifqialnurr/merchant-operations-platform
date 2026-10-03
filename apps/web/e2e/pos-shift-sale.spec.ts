import { expect, type Page, test } from "@playwright/test";

import { openAs } from "./sign-in";

const OPENING_CASH = 100_000;
const PRODUCT = "Kentang Goreng";

function rupiah(text: string) {
  return Number(text.replace(/[^\d-]/g, ""));
}

/** Reads the amount shown for a labelled fact on the shift page. */
async function shiftFact(page: Page, label: string) {
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const match = text.match(new RegExp(`${label} (-?Rp[0-9.]+)`));
  if (!match?.[1]) throw new Error(`"${label}" is not on the shift page.`);
  return rupiah(match[1]);
}

test("a cashier opens a shift, sells for cash, and closes the shift", async ({ page }) => {
  await openAs(page, "pos.cashier@local.test", "/pos/shift");
  await expect(page.getByRole("heading", { name: "Shift" })).toBeVisible();

  // A shift left open by an earlier failed run is reused rather than fought.
  const openShift = page.getByRole("button", { name: "Buka shift" });
  const closeShift = page.getByRole("button", { name: "Tutup shift" });
  await expect(openShift.or(closeShift)).toBeVisible();
  if (await openShift.isVisible()) {
    await page.getByRole("textbox", { name: "Kas awal" }).fill(String(OPENING_CASH));
    await openShift.click();
  }
  await expect(closeShift).toBeVisible();
  await expect(page.getByRole("banner").getByText("Shift terbuka")).toBeVisible();
  const cashBefore = await shiftFact(page, "Kas seharusnya");

  await page.getByRole("link", { name: "Jual" }).click();
  const tile = page.locator(".ui-product-tile", { hasText: PRODUCT });
  const price = rupiah(await tile.innerText());
  await tile.click();
  await page.getByRole("complementary").getByRole("button", { name: "Bayar" }).click();
  await expect(page.getByRole("heading", { name: "Pembayaran" })).toBeVisible();
  // The first preset is the exact amount, so no change is due.
  await page.locator(".ui-chip").first().click();
  await page.getByRole("button", { name: "Konfirmasi pembayaran" }).click();
  await expect(page.getByRole("heading", { name: "Lunas" })).toBeVisible();
  await page.getByRole("button", { name: "Pesanan baru" }).click();

  await page.getByRole("link", { name: "Shift" }).click();
  await expect(closeShift).toBeVisible();
  await expect.poll(() => shiftFact(page, "Kas seharusnya")).toBe(cashBefore + price);

  await closeShift.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Kas fisik" }).fill(String(cashBefore + price));
  await dialog.getByRole("button", { name: "Tutup shift" }).click();
  await expect(page.getByRole("heading", { name: "Shift ditutup" })).toBeVisible();

  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(openShift).toBeVisible();
  await expect(page.getByRole("banner").getByText("Shift belum dibuka")).toBeVisible();
});
