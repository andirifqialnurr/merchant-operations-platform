import assert from "node:assert/strict";
import test from "node:test";

import { PRODUCT_THUMBNAIL, thumbnailSize } from "./image-thumbnail";

test("a large picture is scaled so its longest edge is the stored size", () => {
  assert.deepEqual(thumbnailSize({ height: 3000, width: 4000 }), { height: 600, width: 800 });
  assert.deepEqual(thumbnailSize({ height: 4000, width: 3000 }), { height: 800, width: 600 });
  assert.deepEqual(thumbnailSize({ height: 2000, width: 2000 }), { height: 800, width: 800 });
});

test("a picture that is already small is not enlarged", () => {
  assert.deepEqual(thumbnailSize({ height: 300, width: 400 }), { height: 300, width: 400 });
  assert.deepEqual(thumbnailSize({ height: 800, width: 800 }), { height: 800, width: 800 });
});

test("an extreme shape keeps at least one pixel on its short edge", () => {
  assert.deepEqual(thumbnailSize({ height: 2, width: 8000 }), { height: 1, width: 800 });
  assert.throws(() => thumbnailSize({ height: 0, width: 0 }));
});

test("the stored format is one the API accepts, and stays well under its size limit", () => {
  const accepted = ["image/avif", "image/jpeg", "image/png", "image/webp"];
  for (const type of PRODUCT_THUMBNAIL.types) assert.ok(accepted.includes(type), type);
  // Even uncompressed, 800 x 800 pixels at 4 bytes each is about half of the 5 MB limit.
  assert.ok(PRODUCT_THUMBNAIL.maxEdge ** 2 * 4 < 5 * 1024 * 1024);
});
