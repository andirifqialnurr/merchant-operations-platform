import assert from "node:assert/strict";
import test from "node:test";

import { HttpException } from "@nestjs/common";

import {
  FILE_POLICIES,
  newObjectKey,
  ownsObjectKey,
  sniffImageType,
  UPLOAD_URL_TTL_SECONDS,
} from "./file-policy.js";
import { FileStorageService, type ObjectStorage } from "./file-storage.service.js";
import { createObjectStorage, S3ObjectStorage } from "./s3-object-storage.js";
import { presignS3Url, type S3Config } from "./s3-presign.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f979001";
const OTHER_TENANT = "019f738d-e61f-7d46-92de-17b35f979002";
const NOW = new Date("2026-10-15T08:00:00.000Z");
const policy = FILE_POLICIES.CATALOG_PRODUCT_IMAGE;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1];
const text = (value: string) => [...value].map((character) => character.charCodeAt(0));
const WEBP = [...text("RIFF"), 0x24, 0, 0, 0, ...text("WEBP"), ...text("VP8 ")];
const AVIF = [0, 0, 0, 0x1c, ...text("ftypavif"), 0, 0, 0, 0];
const SVG = text('<svg xmlns="http:');
const HTML = text("<!doctype html><s");

class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, { bytes: number[]; contentType: string; sizeBytes: number }>();
  readonly removed: string[] = [];
  down = false;

  private reach() {
    if (this.down) throw new Error("connect ECONNREFUSED 10.0.0.9:9000 bucket=secret-bucket");
  }

  async head(key: string) {
    this.reach();
    const found = this.objects.get(key);
    return found ? { contentType: found.contentType, sizeBytes: found.sizeBytes } : null;
  }

  async readStart(key: string, length: number) {
    this.reach();
    return new Uint8Array((this.objects.get(key)?.bytes ?? []).slice(0, length));
  }

  async remove(key: string) {
    this.objects.delete(key);
    this.removed.push(key);
  }

  signRead(key: string, expiresIn: number) {
    return `https://storage.test/${key}?read=${expiresIn}`;
  }

  signUpload(key: string, contentType: string, sizeBytes: number, expiresIn: number) {
    return `https://storage.test/${key}?type=${contentType}&size=${sizeBytes}&ttl=${expiresIn}`;
  }
}

function setup() {
  const storage = new MemoryStorage();
  return { service: new FileStorageService(storage), storage };
}

const request = (contentType = "image/png", sizeBytes = 200_000) => ({
  contentType,
  purpose: "CATALOG_PRODUCT_IMAGE" as const,
  sizeBytes,
});

async function codeOf(action: () => unknown) {
  try {
    await action();
    return "OK";
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code: string; message: string };
      return `${error.getStatus()} ${body.code}`;
    }
    throw error;
  }
}

test("an upload ticket names a key the server made up, inside the workspace's folder", () => {
  const { service } = setup();
  const ticket = service.createUpload(TENANT, request(), NOW);

  assert.match(
    ticket.objectKey,
    new RegExp(`^tenants/${TENANT}/catalog/product-images/[0-9a-f-]{36}[.]png$`),
  );
  assert.equal(ticket.method, "PUT");
  assert.deepEqual(ticket.headers, { "Content-Type": "image/png" });
  // The URL is good for exactly this type and size, for a few minutes.
  assert.ok(ticket.uploadUrl.includes("type=image/png&size=200000"));
  assert.ok(ticket.uploadUrl.includes(`ttl=${UPLOAD_URL_TTL_SECONDS}`));
  assert.equal(ticket.expiresAt, new Date(NOW.getTime() + 300_000).toISOString());
  assert.ok(UPLOAD_URL_TTL_SECONDS <= 300);
});

test("only raster images of a bounded size get a ticket", async () => {
  const { service } = setup();
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
    assert.equal(await codeOf(() => service.createUpload(TENANT, request(type))), "OK", type);
  }
  for (const type of ["image/svg+xml", "text/html", "application/pdf", "image/gif"]) {
    assert.equal(
      await codeOf(() => service.createUpload(TENANT, request(type))),
      "400 FILE_TYPE_NOT_ALLOWED",
      type,
    );
  }
  assert.equal(
    await codeOf(() => service.createUpload(TENANT, request("image/png", policy.maxBytes))),
    "OK",
  );
  assert.equal(
    await codeOf(() => service.createUpload(TENANT, request("image/png", policy.maxBytes + 1))),
    "413 FILE_TOO_LARGE",
  );
});

test("a key is accepted only inside the workspace's own folder, with no way out of it", () => {
  const good = newObjectKey(TENANT, policy, "image/png");
  assert.equal(ownsObjectKey(TENANT, policy, good), true);
  // Another workspace's file, however valid, is not this workspace's.
  assert.equal(ownsObjectKey(OTHER_TENANT, policy, good), false);

  const prefix = `tenants/${TENANT}/catalog/product-images`;
  for (const key of [
    `${prefix}/../../../${OTHER_TENANT}/catalog/product-images/a.png`,
    `${prefix}/./a.png`,
    `${prefix}//a.png`,
    `/${prefix}/a.png`,
    `${prefix}/a b.png`,
    `${prefix}/a%2e%2e/b.png`,
    `${prefix}\\..\\a.png`,
    `tenants/${TENANT}/finance/a.png`,
    `tenants/${TENANT}`,
    `${prefix}/${"a".repeat(600)}.png`,
  ]) {
    assert.equal(ownsObjectKey(TENANT, policy, key), false, key);
  }
});

test("the type of a file is what its first bytes say, not what it claims", () => {
  assert.equal(sniffImageType(new Uint8Array(PNG)), "image/png");
  assert.equal(sniffImageType(new Uint8Array(JPEG)), "image/jpeg");
  assert.equal(sniffImageType(new Uint8Array(WEBP)), "image/webp");
  assert.equal(sniffImageType(new Uint8Array(AVIF)), "image/avif");
  assert.equal(sniffImageType(new Uint8Array(SVG)), undefined);
  assert.equal(sniffImageType(new Uint8Array(HTML)), undefined);
  assert.equal(sniffImageType(new Uint8Array([])), undefined);
});

test("a real image passes the check and reports its true type and size", async () => {
  const { service, storage } = setup();
  const { objectKey } = service.createUpload(TENANT, request("image/png"), NOW);
  // The browser claimed PNG but sent a JPEG: the stored type is what counts.
  storage.objects.set(objectKey, { bytes: JPEG, contentType: "image/png", sizeBytes: 150_000 });

  assert.deepEqual(await service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", objectKey), {
    contentType: "image/jpeg",
    objectKey,
    sizeBytes: 150_000,
  });
  assert.deepEqual(storage.removed, []);
});

test("a file that is not an image, or is too large, is refused and removed", async () => {
  const { service, storage } = setup();
  const disguised = service.createUpload(TENANT, request("image/png"), NOW).objectKey;
  storage.objects.set(disguised, { bytes: HTML, contentType: "image/png", sizeBytes: 900 });
  assert.equal(
    await codeOf(() => service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", disguised)),
    "400 FILE_TYPE_NOT_ALLOWED",
  );

  const vector = service.createUpload(TENANT, request("image/png"), NOW).objectKey;
  storage.objects.set(vector, { bytes: SVG, contentType: "image/png", sizeBytes: 900 });
  assert.equal(
    await codeOf(() => service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", vector)),
    "400 FILE_TYPE_NOT_ALLOWED",
  );

  const huge = service.createUpload(TENANT, request("image/png"), NOW).objectKey;
  storage.objects.set(huge, {
    bytes: PNG,
    contentType: "image/png",
    sizeBytes: policy.maxBytes + 1,
  });
  assert.equal(
    await codeOf(() => service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", huge)),
    "400 FILE_TOO_LARGE",
  );

  assert.deepEqual(storage.removed, [disguised, vector, huge]);
  assert.equal(storage.objects.size, 0);
});

test("a missing file and another workspace's file look the same, and nothing is touched", async () => {
  const { service, storage } = setup();
  const theirs = service.createUpload(OTHER_TENANT, request(), NOW).objectKey;
  storage.objects.set(theirs, { bytes: PNG, contentType: "image/png", sizeBytes: 900 });

  const never = newObjectKey(TENANT, policy, "image/png");
  assert.equal(
    await codeOf(() => service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", never)),
    "404 FILE_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() => service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", theirs)),
    "404 FILE_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() => service.readUrl(TENANT, "CATALOG_PRODUCT_IMAGE", theirs)),
    "404 FILE_NOT_FOUND",
  );
  // The other workspace's file is still there.
  assert.equal(storage.objects.has(theirs), true);
  assert.deepEqual(storage.removed, []);
});

test("a storage that cannot be reached is reported without its address or bucket", async () => {
  const { service, storage } = setup();
  const { objectKey } = service.createUpload(TENANT, request(), NOW);
  storage.down = true;
  try {
    await service.verifyUpload(TENANT, "CATALOG_PRODUCT_IMAGE", objectKey);
    assert.fail("expected a refusal");
  } catch (error) {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 503);
    const body = JSON.stringify(error.getResponse());
    assert.ok(body.includes("FILE_STORAGE_UNAVAILABLE"));
    assert.equal(/10[.]0[.]0[.]9|secret-bucket|ECONNREFUSED/.test(body), false);
  }
});

// ---- Signed URLs

const config: S3Config = {
  accessKey: "AKIDEXAMPLE",
  bucket: "merchant-files",
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

test("a signed upload URL fixes the object, the type, the size, and the lifetime", () => {
  const key = `tenants/${TENANT}/catalog/product-images/a.png`;
  const url = new URL(
    presignS3Url(config, {
      expiresIn: 300,
      headers: { "content-length": "1234", "content-type": "image/png" },
      key,
      method: "PUT",
      now: NOW,
    }),
  );

  assert.equal(url.origin, "http://localhost:9000");
  assert.equal(url.pathname, `/merchant-files/${key}`);
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(url.searchParams.get("X-Amz-Date"), "20261015T080000Z");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(
    url.searchParams.get("X-Amz-Credential"),
    "AKIDEXAMPLE/20261015/us-east-1/s3/aws4_request",
  );
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert.match(url.searchParams.get("X-Amz-Signature") ?? "", /^[0-9a-f]{64}$/);
  // The secret key itself is nowhere in the URL.
  assert.equal(url.href.includes("wJalrXUtnFEMI"), false);
});

test("changing anything that was signed changes the signature", () => {
  const key = `tenants/${TENANT}/catalog/product-images/a.png`;
  const sign = (overrides: Partial<Parameters<typeof presignS3Url>[1]>, used = config) =>
    new URL(
      presignS3Url(used, {
        expiresIn: 300,
        headers: { "content-length": "1234", "content-type": "image/png" },
        key,
        method: "PUT",
        now: NOW,
        ...overrides,
      }),
    ).searchParams.get("X-Amz-Signature");

  const base = sign({});
  assert.equal(sign({}), base, "the same input signs the same");
  assert.notEqual(sign({ key: key.replace("a.png", "b.png") }), base);
  assert.notEqual(sign({ method: "GET" }), base);
  assert.notEqual(sign({ expiresIn: 301 }), base);
  assert.notEqual(
    sign({ headers: { "content-length": "9999999", "content-type": "image/png" } }),
    base,
  );
  assert.notEqual(
    sign({ headers: { "content-length": "1234", "content-type": "text/html" } }),
    base,
  );
  assert.notEqual(sign({}, { ...config, secretKey: "another-secret" }), base);
});

test("builds the scope, date, and path-style address of a signed GET", () => {
  const url = new URL(
    presignS3Url(
      { ...config, bucket: "examplebucket", endpoint: "https://s3.amazonaws.com" },
      { expiresIn: 86400, key: "test.txt", method: "GET", now: new Date("2013-05-24T00:00:00Z") },
    ),
  );
  assert.equal(url.searchParams.get("X-Amz-Date"), "20130524T000000Z");
  assert.equal(
    url.searchParams.get("X-Amz-Credential"),
    "AKIDEXAMPLE/20130524/us-east-1/s3/aws4_request",
  );
  assert.equal(url.pathname, "/examplebucket/test.txt");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
});

test("browsers get the public address; the API keeps its own", () => {
  const storage = new S3ObjectStorage(config, "https://files.example.com");
  const upload = new URL(storage.signUpload("tenants/t/a.png", "image/png", 10, 300, NOW));
  assert.equal(upload.origin, "https://files.example.com");
  assert.equal(
    new URL(storage.signRead("tenants/t/a.png", 300, NOW)).origin,
    "https://files.example.com",
  );
});

test("without configuration the storage says so instead of guessing", () => {
  const storage = createObjectStorage({});
  assert.throws(() => storage.signUpload("k", "image/png", 1, 60, NOW), /not configured/);
  const service = new FileStorageService(storage);
  // Asking for a ticket fails loudly rather than handing out a URL to nowhere.
  assert.throws(() => service.createUpload(TENANT, request()), /not configured/);
});

test("the bucket lets only the web app's origins upload and read", async () => {
  const { bucketCorsXml, webOrigins } = await import("./bucket-cors.js");
  assert.deepEqual(webOrigins("https://app.example.com/login, http://localhost:4000"), [
    "https://app.example.com",
    "http://localhost:4000",
  ]);
  assert.deepEqual(webOrigins(undefined), []);
  assert.throws(() => webOrigins("not a url"));

  const xml = bucketCorsXml(["https://app.example.com"]);
  assert.ok(xml.includes("<AllowedOrigin>https://app.example.com</AllowedOrigin>"));
  // Never every origin, and never a method that changes or lists what is stored.
  assert.equal(xml.includes("<AllowedOrigin>*</AllowedOrigin>"), false);
  assert.deepEqual(
    [...xml.matchAll(/<AllowedMethod>(\w+)<\/AllowedMethod>/g)].map((match) => match[1]),
    ["PUT", "GET"],
  );
  // An origin cannot smuggle markup into the rule.
  assert.equal(bucketCorsXml(["https://a.example</AllowedOrigin>"]).includes("example</"), false);
});
