import { expect, test } from "@playwright/test";

const productId = "019f738d-e61f-7d46-92de-17b35f975201";
const categoryId = "019f738d-e61f-7d46-92de-17b35f975202";
const order = (status: string, orderNumber = 1) => ({
  lines: [{ modifiers: [], name: "Latte", productId, quantity: 1 }],
  orderNumber,
  status,
  submittedAt: "2026-10-19T10:00:00.000Z",
  totalMinor: "25000",
});

for (const width of [320, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    for (const locale of ["id", "en"] as const) {
      test(`pending guest order ${width}px ${theme} ${locale}`, async ({ page, baseURL }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page
          .context()
          .addCookies([{ name: "locale", value: locale, url: baseURL ?? "http://localhost:4000" }]);
        let visit = { claim: null, dueMinor: "0", orders: [order("PENDING")], requests: [] };
        await page.route("**/api/v1/public/table-qr/**", async (route) => {
          expect(route.request().method(), "this regression must not submit a mutation").toBe(
            "GET",
          );
          const path = new URL(route.request().url()).pathname;
          const json = path.endsWith("/visit")
            ? visit
            : path.endsWith("/menu")
              ? {
                  categories: [{ id: categoryId, name: "Coffee" }],
                  charges: { included: true, serviceChargeRateBp: 0, taxRateBp: 0 },
                  currency: "IDR",
                  paymentNote: "Pay at the counter",
                  products: [
                    {
                      id: productId,
                      categoryId,
                      name: "Latte",
                      priceMinor: "25000",
                      variants: [],
                      modifierGroups: [],
                    },
                  ],
                }
              : {
                  merchantName: "Coffee",
                  outletName: "Main",
                  tableLabel: "T1",
                  message: null,
                  status: "READY",
                };
          await route.fulfill({ json });
        });
        const openOrders = async () => {
          await page.goto("/t/moderation-readonly-test");
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.getByRole("tab", { name: locale === "id" ? /^Pesanan/ : /^Orders/ }).click();
        };
        const pending = locale === "id" ? "Menunggu persetujuan staf" : "Awaiting staff approval";
        const paidAll =
          locale === "id"
            ? "Semua pesanan sudah dibayar. Terima kasih!"
            : "Everything is paid. Thank you!";
        const claim = locale === "id" ? "Saya sudah bayar" : "I have paid";
        await openOrders();
        await expect(page.getByText(pending, { exact: true })).toHaveCount(1);
        await expect(page.getByText(paidAll, { exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: claim, exact: true })).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ).toBeLessThanOrEqual(1);
        const capture = info.outputPath("pending.png");
        await page.screenshot({ path: capture, fullPage: true, animations: "disabled" });
        await info.attach("pending", { path: capture, contentType: "image/png" });
        // Mixed accepted debt and pending estimates must not offer a claim the backend rejects.
        visit = { ...visit, dueMinor: "25000", orders: [order("RECEIVED"), order("PENDING", 2)] };
        await openOrders();
        await expect(page.getByText(pending, { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: claim, exact: true })).toHaveCount(0);
        visit = { ...visit, orders: [order("RECEIVED")] };
        await openOrders();
        await expect(page.getByRole("button", { name: claim, exact: true })).toBeVisible();
        visit = { ...visit, dueMinor: "0" };
        await openOrders();
        await expect(page.getByText(paidAll, { exact: true })).toBeVisible();
      });
    }
  }
}
