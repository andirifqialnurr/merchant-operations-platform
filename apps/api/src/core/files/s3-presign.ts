import { createHash, createHmac } from "node:crypto";

/**
 * Signs S3 requests as URLs (AWS Signature Version 4, query form). The secret
 * key never leaves the server: a client gets a URL that allows exactly one
 * request, to one object, for a short time.
 */

export type S3Config = {
  accessKey: string;
  bucket: string;
  /** Where the API reaches the storage, e.g. http://localhost:9000. */
  endpoint: string;
  region: string;
  secretKey: string;
};

export type PresignInput = {
  /**
   * Headers the request must send with exactly these values. Signing
   * `content-type` and `content-length` fixes the type and the size of an upload.
   */
  headers?: Record<string, string>;
  /** The object; empty for a request about the bucket itself. */
  key: string;
  method: "DELETE" | "GET" | "HEAD" | "PUT";
  /** A bucket setting to address instead of an object, e.g. "cors". */
  subresource?: string;
  now?: Date;
  /** Seconds the URL stays valid. */
  expiresIn: number;
};

const ALGORITHM = "AWS4-HMAC-SHA256";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

/** RFC 3986 encoding as S3 expects it: everything but unreserved characters. */
function encode(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function amzDate(now: Date) {
  return now.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export function presignS3Url(config: S3Config, input: PresignInput) {
  const now = input.now ?? new Date();
  const endpoint = new URL(config.endpoint);
  const timestamp = amzDate(now);
  const date = timestamp.slice(0, 8);
  const scope = `${date}/${config.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: endpoint.host };
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value.trim();
  }
  const signedNames = Object.keys(headers).sort();
  const signedHeaders = signedNames.join(";");

  // Path style, so one endpoint serves every bucket and no DNS setup is needed.
  const segments = input.key ? [config.bucket, ...input.key.split("/")] : [config.bucket];
  const path = `/${segments.map(encode).join("/")}`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${config.accessKey}/${scope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(input.expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
    ...(input.subresource ? { [input.subresource]: "" } : {}),
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${encode(name)}=${encode(query[name] ?? "")}`)
    .join("&");

  const canonicalRequest = [
    input.method,
    path,
    canonicalQuery,
    ...signedNames.map((name) => `${name}:${headers[name]}`),
    "",
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [ALGORITHM, timestamp, scope, sha256(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretKey}`, date), config.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const base = `${endpoint.protocol}//${endpoint.host}`;
  return `${base}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
