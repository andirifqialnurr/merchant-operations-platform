import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkBoundaries, locate, violation } from "./check-boundaries.mjs";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const at = (path) => join(src, ...path.split("/"));

test("files are placed in an area, a unit, and a layer", () => {
  assert.deepEqual(locate(at("modules/pos-sales/domain/shift.ts")), {
    area: "modules",
    inside: "domain/shift.ts",
    layer: "domain",
    unit: "modules/pos-sales",
  });
  assert.equal(
    locate(at("kernels/catalog/application/catalog.service.ts")).unit,
    "kernels/catalog",
  );
  assert.equal(locate(at("main.ts")).area, "root");
});

test("another unit is only reachable through its public.ts", () => {
  const importer = at("modules/pos-sales/adapters/order.controller.ts");
  assert.equal(violation(importer, "../../../core/auth/public.js"), undefined);
  assert.match(violation(importer, "../../../core/auth/auth.service.js"), /through its public\.ts/);
  assert.match(
    violation(at("main.ts"), "./kernels/order-intake/application/order-intake.service.js"),
    /through its public\.ts/,
  );
});

test("dependencies only point inward", () => {
  assert.match(
    violation(at("core/auth/auth.service.ts"), "../../modules/pos-sales/public.js"),
    /core must not import from modules/,
  );
  assert.match(
    violation(at("core/auth/auth.service.ts"), "../../bootstrap/openapi.js"),
    /core must not import from bootstrap/,
  );
  assert.match(
    violation(
      at("kernels/order-intake/application/a.ts"),
      "../../billing-payment-ledger/public.js",
    ),
    /kernel must not import another kernel/,
  );
  assert.match(
    violation(at("modules/pos-sales/application/a.ts"), "../../kds/public.js"),
    /module must not import another module/,
  );
  assert.match(
    violation(at("shared/validation/zod-validation.pipe.ts"), "../../core/auth/public.js"),
    /shared must not import from core/,
  );
  assert.equal(
    violation(at("modules/pos-sales/application/a.ts"), "../../../kernels/order-intake/public.js"),
    undefined,
  );
});

test("a kernel never imports another kernel, not even through its public.ts", () => {
  // What one kernel needs from another arrives through a port wired at the root.
  const importer = at("kernels/order-intake/application/order-intake.service.ts");
  assert.match(violation(importer, "../../catalog/public.js"), /must not import another kernel/);
  assert.equal(violation(at("kernel-wiring.module.ts"), "./kernels/catalog/public.js"), undefined);
  assert.equal(
    violation(
      at("modules/catalog-profile/adapters/catalog.controller.ts"),
      "../../../kernels/catalog/public.js",
    ),
    undefined,
  );
});

test("layers inside a unit keep the framework and the database at the edge", () => {
  const domain = at("modules/pos-sales/domain/shift.ts");
  const application = at("modules/pos-sales/application/shift.service.ts");
  assert.match(violation(domain, "@nestjs/common"), /domain code must not import a framework/);
  assert.match(violation(domain, "../application/shift.service.js"), /domain code must not import/);
  assert.match(violation(application, "@merchant/database"), /use a port/);
  assert.match(
    violation(application, "../adapters/prisma-shift.repository.js"),
    /depend on a port/,
  );
  assert.equal(violation(application, "../domain/shift.js"), undefined);
  assert.equal(violation(application, "@nestjs/common"), undefined);
  assert.equal(
    violation(at("modules/pos-sales/adapters/prisma-shift.repository.ts"), "@merchant/database"),
    undefined,
  );
});

test("the API source has no boundary violations", () => {
  assert.deepEqual(checkBoundaries(), []);
});
