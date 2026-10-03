import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiSource = join(here, "..", "..", "..", "api", "src");
const messages = join(here, "..", "..", "messages");

/** The API areas whose errors reach the catalog and cashier screens. */
const AREAS = ["catalog", "modules", "kernels"];
/** Access refusals are declared as a table rather than thrown by name. */
const ACCESS_DENIALS = join(apiSource, "core", "entitlements", "access-evaluator.ts");
const THROWN_CODE =
  /(?:notFound|conflict|badRequest|forbidden|unprocessable)\(\s*"([A-Z][A-Z0-9_]+)"|code:\s*"([A-Z][A-Z0-9_]+)"/g;

function sourceFiles(directory: string, found: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) found.push(path);
  }
  return found;
}

function thrownCodes() {
  const codes = new Set<string>();
  for (const area of AREAS) {
    for (const file of sourceFiles(join(apiSource, area))) {
      for (const match of readFileSync(file, "utf8").matchAll(THROWN_CODE)) {
        const code = match[1] ?? match[2];
        if (code) codes.add(code);
      }
    }
  }
  const table = readFileSync(ACCESS_DENIALS, "utf8");
  const start = table.indexOf("export const ACCESS_DENIALS = {");
  const end = table.indexOf("} as const;", start);
  for (const match of table.slice(start, end).matchAll(/^ {2}([A-Z][A-Z0-9_]+):/gm)) {
    if (match[1]) codes.add(match[1]);
  }
  return codes;
}

test("every catalog and cashier error code has a message in both languages", () => {
  const codes = thrownCodes();
  assert.ok(codes.has("CATALOG_PRODUCT_NOT_FOUND"), "the scan finds catalog codes");
  assert.ok(codes.has("POS_SHIFT_NOT_OPEN"), "the scan finds cashier codes");
  assert.ok(codes.has("PERMISSION_DENIED"), "the scan finds access refusal codes");

  for (const locale of ["id", "en"]) {
    const { errors } = JSON.parse(readFileSync(join(messages, `${locale}.json`), "utf8")) as {
      errors: Record<string, string>;
    };
    assert.deepEqual(
      [...codes].filter((code) => !(code in errors)),
      [],
      `${locale}.json translates every code`,
    );
  }
});
