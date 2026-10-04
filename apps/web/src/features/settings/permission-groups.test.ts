import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PERMISSIONS } from "@merchant/contracts";

import { PERMISSION_GROUPS, roleCodeFromName } from "./permission-groups";

const messages = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "messages");
type Tree = { [key: string]: string | Tree };

test("every permission is in exactly one group", () => {
  const grouped = PERMISSION_GROUPS.flatMap((group) => [...group.permissions]);
  assert.deepEqual([...grouped].sort(), Object.values(PERMISSIONS).sort());
  assert.equal(new Set(grouped).size, grouped.length);
});

test("every permission and every group has plain words in both languages", () => {
  for (const locale of ["id", "en"]) {
    const { roles } = JSON.parse(readFileSync(join(messages, `${locale}.json`), "utf8")) as {
      roles: { group: Record<string, string>; permission: Tree };
    };
    for (const group of PERMISSION_GROUPS) {
      assert.ok(roles.group[group.key], `${locale}: group ${group.key}`);
    }
    for (const permission of Object.values(PERMISSIONS)) {
      let node: string | Tree | undefined = roles.permission;
      for (const part of permission.split(".")) {
        node = typeof node === "object" ? node[part] : undefined;
      }
      assert.equal(typeof node, "string", `${locale}: ${permission}`);
      // Words a person understands, not the technical key.
      assert.equal((node as string).includes("."), false, `${locale}: ${permission}`);
    }
  }
});

test("a role's code is made from its name", () => {
  assert.equal(roleCodeFromName("Kasir Senior"), "KASIR_SENIOR");
  assert.equal(roleCodeFromName("  Shift-Leader (Malam)  "), "SHIFT_LEADER_MALAM");
  assert.equal(roleCodeFromName("Café Müller"), "CAFE_MULLER");
  // Nothing usable in the name gives nothing, which the form refuses.
  assert.equal(roleCodeFromName("!!!"), "");
  assert.equal(roleCodeFromName("a".repeat(200)).length, 80);
});
