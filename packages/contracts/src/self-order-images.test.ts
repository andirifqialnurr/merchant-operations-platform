import assert from "node:assert/strict";
import test from "node:test";

import {
  guestMenuProductSchema,
  guestProductImageParamsSchema,
  placeGuestOrderSchema,
} from "./self-order.ts";

const productId = "019f738d-e61f-7d46-92de-17b35f979200";
const product = {
  id: productId,
  categoryId: "019f738d-e61f-7d46-92de-17b35f979201",
  name: "Coffee",
  priceMinor: "20000",
  modifierGroups: [],
  variants: [],
};

test("guest product pictures expose availability only, with no internal media metadata", () => {
  assert.equal(guestMenuProductSchema.parse(product).hasImage, false);
  assert.equal(guestMenuProductSchema.parse({ ...product, hasImage: true }).hasImage, true);
  for (const key of ["tenantId", "outletId", "imageId", "objectKey", "imageUrl", "signedUrl"]) {
    assert.equal(
      guestMenuProductSchema.safeParse({ ...product, [key]: "private" }).success,
      false,
      key,
    );
  }
});

test("image route params contain a bounded QR and public product ID, never a client storage URL", () => {
  assert.equal(
    guestProductImageParamsSchema.safeParse({ token: "a".repeat(43), productId }).success,
    true,
  );
  assert.equal(
    guestProductImageParamsSchema.safeParse({ token: "a".repeat(101), productId }).success,
    false,
  );
  assert.equal(
    guestProductImageParamsSchema.safeParse({
      token: "valid",
      productId: "https://storage.invalid/image",
    }).success,
    false,
  );
  assert.equal(
    guestProductImageParamsSchema.safeParse({ token: "valid", productId, objectKey: "private" })
      .success,
    false,
  );
  assert.equal(
    placeGuestOrderSchema.safeParse({ items: [{ productId, quantity: 1 }], hasImage: true })
      .success,
    false,
  );
});
