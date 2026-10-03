import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

import { localAccount } from "./credentials";

// Playwright runs from apps/web. The folder is Git-ignored.
const AUTH_DIR = join(process.cwd(), "e2e", ".auth");

/**
 * Opens `path` as the given local account. The login session is kept between
 * runs because the API allows only a few sign-ins per account in 15 minutes.
 */
export async function openAs(page: Page, email: string, path: string) {
  const stateFile = join(AUTH_DIR, `${email.split("@")[0]}.json`);
  if (existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    await page.context().addCookies(state.cookies);
  }

  await page.goto(path);
  const password = page.locator('input[type="password"]');
  const signedIn = page.getByRole("navigation", { name: "Navigasi kasir" });
  await expect(password.or(signedIn)).toBeVisible();
  if (await password.isVisible()) {
    const account = localAccount(email);
    await page.getByRole("textbox", { name: "Email" }).fill(account.email);
    await password.fill(account.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(signedIn).toBeVisible();
    mkdirSync(AUTH_DIR, { recursive: true });
    await page.context().storageState({ path: stateFile });
  }
}
