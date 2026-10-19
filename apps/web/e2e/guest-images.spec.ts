import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import id from "../messages/id.json";

test.skip(
  process.env.PLAYWRIGHT_GUEST_IMAGES_DISPOSABLE !== "1",
  "Use test:e2e:guest-images with its owned database/storage fixture.",
);
let api: ChildProcess;
let fixture: { token: string; productId: string; plainId: string };
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));
test.beforeAll(async () => {
  test.setTimeout(90_000);
  api = fork(resolve("../api/test/guest-images-browser-fixture.mjs"), {
    cwd: resolve("../api"),
    execArgv: ["--env-file-if-exists=../../.env", "--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  api.stdout?.resume();
  api.stderr?.resume();
  fixture = await new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("Guest image fixture timed out.")), 60_000);
    api.once("error", reject);
    api.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Guest image fixture exited before readiness."));
    });
    api.on("message", (value: unknown) => {
      const message = value as { type?: string; data?: typeof fixture; message?: string };
      if (message.type === "ready" && message.data) {
        clearTimeout(timeout);
        accept(message.data);
      } else if (message.type === "failed") {
        clearTimeout(timeout);
        reject(new Error(message.message ?? "Guest image fixture failed."));
      }
    });
  });
});
test.afterAll(async () => {
  if (!api || api.exitCode !== null || !api.connected) return;
  const exited = once(api, "exit");
  api.send({ type: "stop" });
  await exited;
});
const pictured = (page: Page) => page.getByRole("button", { name: /Kopi foto/ });
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(await page.locator(".ui-panel .ui-panel").count()).toBe(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("real raster media and no-photo products fit S/M/L, themes and languages without internal URLs", async ({
  page,
}, info) => {
  for (const width of [320, 768, 1440])
    for (const theme of ["light", "dark"] as const)
      for (const locale of ["id", "en"] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page
          .context()
          .addCookies([{ name: "locale", value: locale, url: "http://localhost:4100" }]);
        await page.goto(`/t/${fixture.token}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const image = pictured(page).locator("img");
        await expect(image).toHaveAttribute("alt", "");
        await expect
          .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
          .toBeGreaterThan(0);
        await expect(image).toHaveAttribute(
          "src",
          new RegExp(`/public/table-qr/[^/]+/products/${fixture.productId}/image$`),
        );
        expect(await image.getAttribute("src")).not.toMatch(
          /tenants\/|product-images|X-Amz|storage|bucket/,
        );
        await expect(
          page.getByRole("button", { name: /Teh tanpa foto/ }).locator("img"),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: /Teh tanpa foto/ }).locator('[data-image="none"]'),
        ).toBeVisible();
        await expect(pictured(page).getByText("Kopi foto", { exact: true })).toHaveCount(1);
        await capture(page, info, `pictures-${width}-${theme}-${locale}`);
      }
});

test("failed images fall back without disabling selection or guest submission", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.context().addCookies([{ name: "locale", value: "id", url: "http://localhost:4100" }]);
  await page.route("**/public/table-qr/**/products/*/image", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "FILE_STORAGE_UNAVAILABLE",
        message: "Fixture storage failure",
        requestId: "image-failure",
      },
    }),
  );
  await page.goto(`/t/${fixture.token}`);
  await expect(pictured(page).locator('[data-image="failed"]')).toBeVisible();
  await expect(pictured(page)).toBeEnabled();
  await capture(page, info, "image-fallback-320");
  await pictured(page).click();
  await page.locator(".ui-sticky-cart-bar__button").click();
  await page.getByRole("dialog").getByRole("button", { name: id.guest.send, exact: true }).click();
  await expect(page.getByText(id.guest.status.PENDING, { exact: true })).toBeVisible();
});

test("a menu with no image availability stays compact and issues no image requests", async ({
  page,
}, info) => {
  let reads = 0;
  page.on("request", (request) => {
    if (/\/products\/[^/]+\/image$/.test(request.url())) reads++;
  });
  await page.route("**/public/table-qr/*/menu", async (route) => {
    const response = await route.fetch();
    const menu = await response.json();
    await route.fulfill({
      response,
      json: {
        ...menu,
        products: menu.products.map((product: object) => ({ ...product, hasImage: false })),
      },
    });
  });
  await page.goto(`/t/${fixture.token}`);
  await expect(pictured(page)).toBeVisible();
  await expect(pictured(page)).toHaveClass(/ui-product-tile--compact/);
  await expect(page.locator(".ui-product-tile__media")).toHaveCount(0);
  expect(reads).toBe(0);
  await capture(page, info, "no-pictures-compact");
});
