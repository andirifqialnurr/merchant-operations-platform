import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { API_HEADERS, MODULES, PERMISSIONS } from "@merchant/contracts";
import { BadRequestException } from "@nestjs/common";

import { CatalogController } from "./catalog.controller.js";
import type { CatalogService } from "./catalog.service.js";

const TENANT_ID = "019f738d-e61f-7d46-92de-17b35f971401";
const OUTLET_A = "019f738d-e61f-7d46-92de-17b35f971402";
const OUTLET_B = "019f738d-e61f-7d46-92de-17b35f971403";

const requiredPermission = (handler: (...args: never[]) => unknown) =>
  Reflect.getMetadata("required-access-permission", handler) as string | undefined;
const requiresAllOutlets = (handler: (...args: never[]) => unknown) =>
  Reflect.getMetadata("require-all-outlets", handler) as boolean | undefined;

test("protects the Catalog controller with the Core Catalog entitlement", () => {
  assert.equal(
    Reflect.getMetadata("required-entitlement-module", CatalogController),
    MODULES.coreCatalog,
  );
});

test("requires tenant-wide scope for master Catalog reads and mutations", () => {
  assert.equal(requiredPermission(CatalogController.prototype.snapshot), PERMISSIONS.catalogRead);
  assert.equal(requiresAllOutlets(CatalogController.prototype.snapshot), true);

  const mutationHandlers = [
    CatalogController.prototype.createCategory,
    CatalogController.prototype.updateCategory,
    CatalogController.prototype.createProduct,
    CatalogController.prototype.updateProduct,
    CatalogController.prototype.createVariant,
    CatalogController.prototype.updateVariant,
    CatalogController.prototype.createModifierGroup,
    CatalogController.prototype.updateModifierGroup,
    CatalogController.prototype.createModifierOption,
    CatalogController.prototype.updateModifierOption,
    CatalogController.prototype.createProductModifierGroup,
    CatalogController.prototype.updateProductModifierGroup,
    CatalogController.prototype.createProductImage,
    CatalogController.prototype.updateProductImage,
  ];

  for (const handler of mutationHandlers) {
    assert.equal(requiredPermission(handler), PERMISSIONS.catalogManage);
    assert.equal(requiresAllOutlets(handler), true);
  }
});

test("keeps outlet Catalog routes outlet-scoped", () => {
  assert.equal(
    requiredPermission(CatalogController.prototype.outletSnapshot),
    PERMISSIONS.catalogRead,
  );
  assert.equal(requiresAllOutlets(CatalogController.prototype.outletSnapshot), undefined);
  assert.equal(
    requiredPermission(CatalogController.prototype.createOutletProduct),
    PERMISSIONS.catalogManage,
  );
  assert.equal(
    requiredPermission(CatalogController.prototype.updateOutletProduct),
    PERMISSIONS.catalogManage,
  );
});

test("rejects a route outlet that differs from the authorized outlet header", async () => {
  let serviceCalled = false;
  const service = {
    getOutletCatalog: async () => {
      serviceCalled = true;
      return {};
    },
  } as unknown as CatalogService;
  const controller = new CatalogController(service);

  await assert.rejects(
    () =>
      controller.outletSnapshot(
        {
          [API_HEADERS.outletId]: OUTLET_A,
          [API_HEADERS.tenantId]: TENANT_ID,
        },
        { outletId: OUTLET_B },
      ),
    BadRequestException,
  );
  assert.equal(serviceCalled, false);
});
