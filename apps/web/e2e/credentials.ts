import { readFileSync } from "node:fs";
import { join } from "node:path";

// Playwright runs from apps/web.
const LOCAL_CREDENTIALS = join(process.cwd(), "..", "..", "CREDENTIALS.local.md");

/**
 * Sign-in details for a local account: `E2E_EMAIL`/`E2E_PASSWORD` when set,
 * otherwise the row for `email` in the Git-ignored CREDENTIALS.local.md.
 */
export function localAccount(email: string) {
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
    return { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
  }
  const row = readFileSync(LOCAL_CREDENTIALS, "utf8")
    .split("\n")
    .find((line) => line.includes(email));
  const password = row?.split("|")[4]?.trim().replace(/`/g, "");
  if (!password) {
    throw new Error(
      `No local account ${email}. Run "pnpm --filter @merchant/api local:users:provision".`,
    );
  }
  return { email, password };
}
