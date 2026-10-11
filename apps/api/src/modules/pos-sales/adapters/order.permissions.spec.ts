import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSIONS } from "@merchant/contracts";

import { DEFAULT_ROLE_DEFINITIONS } from "../../../core/memberships/access.service.js";
import { refundAuthority } from "../domain/refund-authority.js";
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

test("a refund is open to the cashier screen but answers to payment.refund", () => {
  // The door is order.create; who may refund is decided inside, per request.
  assert.equal(requiredPermission("refund"), PERMISSIONS.orderCreate);
  assert.equal(refundAuthority([PERMISSIONS.orderCreate, PERMISSIONS.paymentRefund], false), "own");
  // Someone who may refund does not need anybody else, even if an approval is sent.
  assert.equal(refundAuthority([PERMISSIONS.paymentRefund], true), "own");
  assert.equal(refundAuthority([PERMISSIONS.orderCreate], true), "approval");
  assert.equal(refundAuthority([PERMISSIONS.orderCreate], false), "refused");
  assert.equal(refundAuthority([], false), "refused");
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
