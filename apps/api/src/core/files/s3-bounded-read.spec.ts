import assert from "node:assert/strict";
import test from "node:test";

import { FileStorageService, StoredObjectTooLarge } from "./file-storage.service.js";
import { S3ObjectStorage } from "./s3-object-storage.js";

const config = {
  accessKey: "test-access",
  secretKey: "test-secret",
  bucket: "test-bucket",
  region: "test",
  endpoint: "https://private-storage.invalid",
};
const key = "tenants/019f738d-e61f-7d46-92de-17b35f979001/catalog/product-images/test.png";

async function withFetch(
  action: () => Promise<void>,
  response: (init: RequestInit | undefined) => Response,
) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => response(init);
  try {
    await action();
  } finally {
    globalThis.fetch = previous;
  }
}

test("full object reads use the private endpoint, timeout and no redirects, without requiring Content-Length", async () => {
  const storage = new S3ObjectStorage(config, "https://browser-storage.invalid");
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/private-storage[.]invalid\//);
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(new Uint8Array([1, 2, 3]));
  };
  try {
    assert.deepEqual(await storage.readContent(key, 4), new Uint8Array([1, 2, 3]));
  } finally {
    globalThis.fetch = previous;
  }
});

test("declared oversize is refused before buffering; a false small header cannot bypass the streaming bound", async () => {
  const storage = new S3ObjectStorage(config);
  await withFetch(
    async () => {
      await assert.rejects(storage.readContent(key, 4), StoredObjectTooLarge);
    },
    () => new Response(new Uint8Array([1]), { headers: { "Content-Length": "5" } }),
  );
  let canceled = false;
  await withFetch(
    async () => {
      await assert.rejects(storage.readContent(key, 4), StoredObjectTooLarge);
      assert.equal(canceled, true);
    },
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.enqueue(new Uint8Array([4, 5, 6]));
          },
          cancel() {
            canceled = true;
          },
        }),
        { headers: { "Content-Length": "1" } },
      ),
  );
});

test("missing objects return null; timeout/redirect/storage failure is sanitized by the file service", async () => {
  const storage = new S3ObjectStorage(config);
  await withFetch(
    async () => {
      assert.equal(await storage.readContent(key, 4), null);
    },
    () => new Response(null, { status: 404 }),
  );
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("private endpoint bucket/test-secret refused redirect");
  };
  try {
    await assert.rejects(
      new FileStorageService(storage).readImage(
        "019f738d-e61f-7d46-92de-17b35f979001",
        "CATALOG_PRODUCT_IMAGE",
        key,
      ),
      (error: unknown) => {
        const body = (error as { getResponse(): unknown }).getResponse();
        assert.equal((body as { code: string }).code, "FILE_STORAGE_UNAVAILABLE");
        assert.doesNotMatch(JSON.stringify(body), /bucket|secret|endpoint|redirect/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = previous;
  }
});
