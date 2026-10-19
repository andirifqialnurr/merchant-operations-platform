import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import process from "node:process";
import { URL } from "node:url";
import { deflateSync } from "node:zlib";

/** A generated, valid cup illustration used only in owned disposable tests. */
function productPng() {
  const width = 96,
    height = 64;
  const pixels = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const cup = x >= 27 && x < 65 && y >= 22 && y < 46;
      const coffee = ((x - 46) / 19) ** 2 + ((y - 22) / 6) ** 2 <= 1;
      const saucer = ((x - 48) / 32) ** 2 + ((y - 48) / 5) ** 2 <= 1;
      const color = coffee
        ? [63, 48, 37]
        : cup
          ? [244, 244, 242]
          : saucer
            ? [170, 170, 168]
            : [218, 212, 201];
      const offset = y * (1 + width * 3) + 1 + x * 3;
      pixels.set(color, offset);
    }
  const chunk = (name, data) => {
    const type = Buffer.from(name),
      size = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    let checksum = 0xffffffff;
    for (const value of Buffer.concat([type, data])) {
      checksum ^= value;
      for (let bit = 0; bit < 8; bit++)
        checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
    crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, type, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export const PRODUCT_PNG = productPng();

/** Never contacts an existing bucket: signed requests go to this owned loopback server. */
export async function withImageStorage(run) {
  const objects = new Map();
  const reads = { full: 0, prefix: 0, redirected: 0 };
  let mode = "normal";
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    if (url.pathname === "/redirect-target") {
      reads.redirected++;
      response.end("unexpected");
      return;
    }
    const key = decodeURIComponent(url.pathname).replace(/^\/fixture-bucket\//, "");
    const bytes = objects.get(key);
    if (!bytes) {
      response.writeHead(404).end();
      return;
    }
    if (mode === "unavailable") {
      response.writeHead(503).end("private-storage-error");
      return;
    }
    if (request.method === "HEAD") {
      response
        .writeHead(200, { "content-length": bytes.length, "content-type": "image/png" })
        .end();
      return;
    }
    const range = request.headers.range?.match(/^bytes=0-(\d+)$/);
    if (range) {
      reads.prefix++;
      const prefix = bytes.subarray(0, Number(range[1]) + 1);
      response.writeHead(206, { "content-length": prefix.length }).end(prefix);
      return;
    }
    reads.full++;
    if (mode === "redirect") {
      response
        .writeHead(302, { location: `http://127.0.0.1:${server.address().port}/redirect-target` })
        .end();
      return;
    }
    if (mode === "oversize") {
      response.writeHead(200, { "content-length": 5 * 1024 * 1024 + 1 });
      response.flushHeaders();
      response.end("too large");
      return;
    }
    if (mode === "stream-oversize") {
      response.writeHead(200);
      const chunk = Buffer.alloc(1024 * 1024);
      for (let index = 0; index < 6; index++) response.write(chunk);
      response.end();
      return;
    }
    const body =
      mode === "html" ? Buffer.from("<!doctype html><script>not an image</script>") : bytes;
    response
      .writeHead(200, {
        "content-type": "text/html",
        "content-length": body.length,
        "x-private-bucket": "do-not-forward",
      })
      .end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const env = {
    OBJECT_STORAGE_ACCESS_KEY: "fixture-access",
    OBJECT_STORAGE_SECRET_KEY: "fixture-secret",
    OBJECT_STORAGE_BUCKET: "fixture-bucket",
    OBJECT_STORAGE_REGION: "test",
    OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
    OBJECT_STORAGE_PUBLIC_ENDPOINT: "https://must-not-reach.invalid",
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    return await run({
      put: (key, bytes = PRODUCT_PNG) => objects.set(key, bytes),
      remove: (key) => objects.delete(key),
      reads,
      setMode: (value) => {
        mode = value;
      },
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
