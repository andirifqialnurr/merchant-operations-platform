import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

// The normal E2E suite uses a developer API. This spec must use the separate
// config so its temporary API can own port 4001 without touching local data.
const dedicated = process.env.PLAYWRIGHT_KDS_DISPOSABLE === "1";
test.skip(!dedicated, "Use pnpm --filter @merchant/web test:e2e:kds (disposable API/database).");

type Cookie = { name: string; value: string };
type Fixture = { kitchenCookies: Cookie[]; ownerCookies: Cookie[] };
let api: ChildProcess;
let fixture: Fixture;

test.beforeAll(async () => {
  test.setTimeout(90_000);
  api = fork(resolve("../api/test/kds-browser-fixture.mjs"), {
    cwd: resolve("../api"),
    execArgv: ["--env-file-if-exists=../../.env", "--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  // No fixture stdout/stderr is replayed: IPC gives only safe setup errors.
  api.stdout?.resume();
  api.stderr?.resume();
  fixture = await new Promise<Fixture>((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("KDS fixture setup timed out.")), 60_000);
    api.once("error", reject);
    api.once("exit", () => {
      clearTimeout(timeout);
      reject(
        new Error("KDS fixture exited before it was ready; check PostgreSQL and free port 4001."),
      );
    });
    api.on("message", (value: unknown) => {
      const message = value as { type?: string; data?: Fixture; message?: string };
      if (message.type === "ready" && message.data) {
        clearTimeout(timeout);
        accept(message.data);
      } else if (message.type === "failed") {
        clearTimeout(timeout);
        reject(new Error(message.message ?? "KDS fixture failed."));
      }
    });
  });
});

test.afterAll(async () => {
  if (!api || api.exitCode !== null) return;
  const exited = once(api, "exit");
  api.send({ type: "stop" });
  // Let the fixture close Nest/Prisma and drop its owned database normally.
  await exited;
});

async function open(page: Page, role: "kitchen" | "owner", path = "/kds") {
  const base = process.env.E2E_BASE_URL ?? "http://localhost:4000";
  await page.context().addCookies(
    (role === "kitchen" ? fixture.kitchenCookies : fixture.ownerCookies).map((cookie) => ({
      ...cookie,
      url: base,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
  );
  await page.goto(path);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, name).toBeLessThanOrEqual(1);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("manual ticket goes through each step and stays in finished history", async ({
  page,
}, info) => {
  await open(page, "kitchen");
  await expect(page.getByRole("heading", { name: "Dapur", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tambah ticket", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Tambah ticket", exact: true });
  await sheet.getByRole("button", { name: "Tambah ticket", exact: true }).click();
  await expect(sheet.getByText("Isi label, misalnya nomor meja atau nama pemesan.")).toBeVisible();
  await sheet.getByLabel("Label pesanan").fill("Browser manual");
  await sheet.getByLabel("Nama item").fill("Kopi susu");
  await sheet.getByLabel("Catatan").fill("Tanpa gula");
  await sheet.getByRole("button", { name: "Tambah ticket", exact: true }).click();
  await expect(sheet).toBeHidden();
  const ticket = page.getByRole("article", { name: "Ticket Browser manual", exact: true });
  await expect(ticket.getByText("Tanpa gula")).toBeVisible();
  await capture(page, info, "manual-created");
  for (const action of ["Terima", "Mulai siapkan", "Tandai siap", "Sudah disajikan"]) {
    await ticket.getByRole("button", { name: action, exact: true }).click();
  }
  await expect(ticket).toBeHidden();
  await page.getByRole("tab", { name: "Selesai hari ini" }).click();
  await expect(ticket).toBeVisible();
  await expect(ticket.getByRole("button")).toHaveCount(0);
  await expect(ticket.getByText("Disajikan", { exact: true })).toBeVisible();
  await capture(page, info, "manual-finished");
});

test("kitchen is usable across screen sizes, themes, languages, kiosk and offline recovery", async ({
  page,
}, info) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let locale: "id" | "en" = "id";
  let theme: "light" | "dark" = "light";
  // Only override the browser's read response; no stored account preference is changed.
  await page.route("**/api/v1/auth/session", async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const session = await response.json();
    await route.fulfill({
      response,
      json: { ...session, user: { ...session.user, locale, theme } },
    });
  });
  await open(page, "kitchen");
  for (const width of [320, 390, 767, 768, 1024, 1279, 1280, 1440]) {
    for (const nextTheme of ["light", "dark"] as const) {
      for (const nextLocale of ["id", "en"] as const) {
        theme = nextTheme;
        locale = nextLocale;
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page
          .context()
          .addCookies([{ name: "locale", value: locale, url: new URL(page.url()).origin }]);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const tickets = page.getByRole("article");
        await expect(tickets).toHaveCount(4);
        await expect(page.getByRole("article", { name: /Visual ACCEPTED/ })).toHaveClass(/warning/);
        await expect(page.getByRole("article", { name: /Visual PREPARING/ })).toHaveClass(
          /breached/,
        );
        const actionHeights = await page
          .locator(".ui-kds-ticket__action")
          .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
        expect(actionHeights.every((height) => height >= 44)).toBe(true);
        await capture(page, info, `queue-${width}-${theme}-${locale}`);
      }
    }
  }
  await page.getByRole("button", { name: "Sound settings", exact: true }).click();
  const enabled = page.getByRole("switch", { name: "Sound new tickets" });
  await expect(enabled).toBeChecked();
  await enabled.focus();
  await page.keyboard.press("Space");
  await expect(enabled).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Play test sound", exact: true })).toBeDisabled();
  await enabled.focus();
  await page.keyboard.press("Space");
  await expect(enabled).toBeChecked();
  await page.getByRole("radio", { name: "Quiet", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kds.sound") ?? "{}").volume))
    .toBe("low");
  // Fullscreen is a browser action; geometric checks are not a physical distance test.
  const kiosk = page.getByRole("button", { name: /^(Full screen|Layar penuh)$/ });
  await kiosk.click();
  await expect(page.locator(".ui-kds-ticket--kiosk")).toHaveCount(4);
  const kioskHeight = await page
    .locator(".ui-kds-ticket__action")
    .first()
    .evaluate((button) => button.getBoundingClientRect().height);
  expect(kioskHeight).toBeGreaterThanOrEqual(64);
  await capture(page, info, "kiosk-1440-dark");
  await page.evaluate(() => document.exitFullscreen());
  await page.context().setOffline(true);
  await expect(page.locator(".ui-kds-connection-status--offline")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.context().setOffline(false);
  await expect(page.locator(".ui-kds-connection-status")).toBeHidden({ timeout: 30_000 });
  expect(pageErrors).toEqual([]);
});

test("owner creates one source, sees the real package limit, and revokes its key", async ({
  page,
}, info) => {
  await open(page, "owner", "/settings/kitchen-intake");
  await page.getByRole("button", { name: "Tambah sistem", exact: true }).click();
  let sheet = page.getByRole("dialog", { name: "Sistem luar baru" });
  await sheet.getByLabel("Nama sistem").fill("Website browser");
  await sheet.getByRole("button", { name: "Tambah", exact: true }).click();
  sheet = page.getByRole("dialog", { name: "Website browser", exact: true });
  await expect(sheet.getByText("Kunci ini tidak akan ditampilkan lagi.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  // Generated for this disposable DB only; never put it in screenshots/output.
  const key = await sheet.locator("code").first().innerText();
  await sheet.getByRole("button", { name: "Selesai", exact: true }).click();
  const send = () =>
    page.request.post("/api/v1/kds/intake/tickets", {
      headers: { authorization: `Bearer ${key}`, "x-csrf-token": "browser-kds-test-csrf" },
      data: {
        reference: "browser-api",
        orderLabel: "Browser API",
        items: [{ name: "Teh", quantity: 1 }],
      },
    });
  expect((await send()).status()).toBe(201);
  expect((await send()).status()).toBe(200);
  await page.goto("/kds");
  const incoming = page.getByRole("article", { name: "Ticket Browser API", exact: true });
  await expect(incoming.getByText("Integrasi", { exact: true })).toBeVisible();
  await capture(page, info, "api-ticket-visible");
  await page.goto("/settings/kitchen-intake");
  await expect(page.getByRole("row", { name: /Website browser/ })).toBeVisible();
  await page.getByRole("button", { name: "Tambah sistem", exact: true }).click();
  sheet = page.getByRole("dialog", { name: "Sistem luar baru" });
  await sheet.getByLabel("Nama sistem").fill("Second browser");
  await sheet.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(sheet.locator(".ui-usage-limit")).toBeVisible();
  await expect(sheet.getByText("Sistem luar dapur aktif", { exact: true })).toBeVisible();
  await expect(sheet.getByText("kds.intake_sources.active", { exact: true })).toHaveCount(0);
  await capture(page, info, "source-limit-real-package");
  await page.keyboard.press("Escape");
  await page.getByRole("row", { name: /Website browser/ }).click();
  await page
    .getByRole("dialog", { name: "Website browser", exact: true })
    .getByRole("button", { name: "Cabut", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Cabut Website browser?", exact: true })
    .getByRole("button", { name: "Cabut", exact: true })
    .click();
  await expect(
    page.getByRole("row", { name: /Website browser/ }).getByText("Dicabut", { exact: true }),
  ).toBeVisible();
  expect((await send()).status()).toBe(401);
});
