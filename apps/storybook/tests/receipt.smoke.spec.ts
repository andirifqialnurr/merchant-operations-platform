import { expect, test } from "@playwright/test";

test("grouped visit bill and pending receipt stories reflow without duplicate transactions", async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/iframe.html?id=domain-pos-receipt--visit-bill&viewMode=story");
    const receipt = page.getByRole("region", { name: "Struk", exact: true });
    await expect(receipt.getByText("Tunai", { exact: true })).toHaveCount(1);
    await expect(receipt.locator(".ui-receipt__group")).toHaveCount(3);
    expect(
      await receipt.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.goto("/iframe.html?id=domain-pos-receipt--pending-visit&viewMode=story");
    await expect(page.getByText("Bill · Awaiting review", { exact: true })).toBeVisible();
    await expect(page.locator(".ui-receipt__line > span")).toHaveCount(1);
  }
});

test("sheet initial-focus story selects its scoped target and Escape restores its trigger", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=primitives-overlay--return-focus-target&viewMode=story");
  const trigger = page.getByRole("button", { name: "Kembali ke kunjungan", exact: true });
  await trigger.click();
  await expect(page.getByRole("button", { name: "Tagihan / struk", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.goto("/iframe.html?id=primitives-overlay--menus-above&viewMode=story");
  await page.getByRole("button", { name: "Aksi lainnya", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveClass(/ui-dropdown--top/);
  for (const item of await page.getByRole("menuitem").all())
    await expect(item).toBeInViewport({ ratio: 1 });
});
