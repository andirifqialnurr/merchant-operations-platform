import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSIONS } from "@merchant/contracts";

import { DEFAULT_ROLE_DEFINITIONS } from "../../../core/memberships/access.service.js";
import { OrderController } from "./order.controller.js";

// The key RequirePermission writes and SessionPermissionGuard reads.
const REQUIRED_PERMISSION = "required-access-permission";

function requiredPermission(handler: keyof OrderController) {
  return Reflect.getMetadata(REQUIRED_PERMISSION, OrderController.prototype[handler]);
}

function roleCan(code: string, permission: string) {
  const role = DEFAULT_ROLE_DEFINITIONS.find((definition) => definition.code === code);
  assert.ok(role, `role ${code} is defined`);
  return role.permissionKeys.some((key) => key === permission);
}

test("refunding an order requires payment.refund", () => {
  assert.equal(requiredPermission("refund"), PERMISSIONS.paymentRefund);
});

test("canceling an order requires order.cancel", () => {
  assert.equal(requiredPermission("cancel"), PERMISSIONS.orderCancel);
});

test("a cashier may cancel but not refund; a waiter may do neither", () => {
  assert.equal(roleCan("CASHIER", PERMISSIONS.orderCancel), true);
  assert.equal(roleCan("CASHIER", PERMISSIONS.paymentRefund), false);
  assert.equal(roleCan("WAITER", PERMISSIONS.orderCancel), false);
  assert.equal(roleCan("WAITER", PERMISSIONS.paymentRefund), false);
  assert.equal(roleCan("MANAGER", PERMISSIONS.paymentRefund), true);
});
