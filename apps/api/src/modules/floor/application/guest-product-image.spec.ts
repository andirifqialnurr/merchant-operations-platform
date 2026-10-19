import assert from "node:assert/strict";
import test from "node:test";

import type { HttpException } from "@nestjs/common";

import type { CatalogService } from "../../../kernels/catalog/public.js";
import type { TableQrCodes } from "./table-qr-codes.js";
import { GuestProductImage, GUEST_IMAGE_RATE_LIMITS } from "./guest-product-image.js";

const productId = "019f738d-e61f-7d46-92de-17b35f979100";
const token = "a".repeat(43);
const code = (error: unknown) => (error as HttpException).getStatus();
function setup(status = "READY") {
  const calls = { menu: 0, content: 0, target: 0 };
  const codes = {
    target: async () => {
      calls.target++;
      return {
        target: status === "INVALID" ? null : { tenantId: "workspace", outletId: "outlet" },
        resolution: { status },
      };
    },
  } as unknown as TableQrCodes;
  const catalog = {
    getSellableMenu: async (tenant: string, outlet: string) => {
      calls.menu++;
      assert.equal(tenant, "workspace");
      assert.equal(outlet, "outlet");
      return { products: [{ id: productId, imageId: "private-image" }] };
    },
    primaryProductImageContent: async (tenant: string, image: string) => {
      calls.content++;
      assert.equal(tenant, "workspace");
      assert.equal(image, "private-image");
      return { contentType: "image/png", bytes: new Uint8Array([1]) };
    },
  } as unknown as CatalogService;
  return { image: new GuestProductImage(codes, catalog), calls };
}

test("only a ready QR and a currently sellable product allow a private image read", async () => {
  for (const status of ["INVALID", "CLOSED"]) {
    const { image, calls } = setup(status);
    await assert.rejects(image.execute(token, productId, "test"), (error) => code(error) === 404);
    assert.equal(calls.menu, 0);
    assert.equal(calls.content, 0);
  }
  const { image, calls } = setup();
  await assert.rejects(
    image.execute(token, "another-product", "test"),
    (error) => code(error) === 404,
  );
  assert.equal(calls.content, 0);
  assert.equal((await image.execute(token, productId, "test")).contentType, "image/png");
  assert.equal(calls.content, 1);
});

test("image rate limits count refusals before QR/catalog/storage lookup, separately for QR and IP", async () => {
  const table = setup("INVALID");
  for (let index = 0; index < GUEST_IMAGE_RATE_LIMITS.table.limit; index++)
    await assert.rejects(
      table.image.execute(token, productId, `phone-${index}`),
      (error) => code(error) === 404,
    );
  await assert.rejects(
    table.image.execute(token, productId, "new-phone"),
    (error) => code(error) === 429,
  );
  assert.equal(table.calls.target, GUEST_IMAGE_RATE_LIMITS.table.limit);
  const address = setup("INVALID");
  for (let index = 0; index < GUEST_IMAGE_RATE_LIMITS.address.limit; index++)
    await assert.rejects(
      address.image.execute(`qr-${index}`, productId, "one-address"),
      (error) => code(error) === 404,
    );
  await assert.rejects(
    address.image.execute("fresh-qr", productId, "one-address"),
    (error) => code(error) === 429,
  );
  assert.equal(address.calls.target, GUEST_IMAGE_RATE_LIMITS.address.limit);
});
