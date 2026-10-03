import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MODULES } from "@merchant/contracts";

const here = dirname(fileURLToPath(import.meta.url));
const apiSource = join(here, "..", "..", "..", "api", "src");
const messages = join(here, "..", "..", "messages");

function manifestFiles(directory: string, found: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) manifestFiles(path, found);
    else if (entry.name === "manifest.ts") found.push(path);
  }
  return found;
}

/** Module keys whose manifest registers at least one menu entry. */
function modulesWithMenuEntries() {
  const keys: string[] = [];
  for (const file of manifestFiles(apiSource)) {
    const source = readFileSync(file, "utf8");
    if (!/navigation: \[\s*\{/.test(source)) continue;
    const names = [...source.matchAll(/key: MODULES\.(\w+)/g)].map((match) => match[1]);
    assert.equal(names.length, 1, `${file} declares a menu and must describe exactly one module`);
    const key = MODULES[names[0] as keyof typeof MODULES];
    assert.ok(key, `${file} names an unknown module`);
    keys.push(key);
  }
  return keys.sort();
}

test("every module that brings a menu entry has a name and an icon in the web app", () => {
  const keys = modulesWithMenuEntries();
  assert.ok(keys.includes(MODULES.pos) && keys.includes(MODULES.coreCatalog));

  const known = readFileSync(join(here, "module-navigation.tsx"), "utf8");
  for (const key of keys) {
    assert.ok(known.includes(`${key}: { icon:`), `${key} has no entry in MODULE_NAVIGATION`);
    for (const locale of ["id", "en"]) {
      const { shell } = JSON.parse(readFileSync(join(messages, `${locale}.json`), "utf8")) as {
        shell: { moduleNav: Record<string, string> };
      };
      assert.ok(shell.moduleNav[key], `${locale}.json has no menu name for ${key}`);
    }
  }
});

test("the dictionaries name no module that has no menu entry", () => {
  const keys = modulesWithMenuEntries();
  for (const locale of ["id", "en"]) {
    const { shell } = JSON.parse(readFileSync(join(messages, `${locale}.json`), "utf8")) as {
      shell: { moduleNav: Record<string, string> };
    };
    assert.deepEqual(Object.keys(shell.moduleNav).sort(), keys, locale);
  }
});
