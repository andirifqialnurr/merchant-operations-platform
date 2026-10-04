import { createHash } from "node:crypto";

import { presignS3Url, type S3Config } from "./s3-presign.js";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * The CORS rule a bucket needs so browsers of the web app can upload to a
 * signed URL and read images: those origins only, PUT and GET only, and the
 * one header an upload sends.
 */
export function bucketCorsXml(origins: readonly string[]) {
  return [
    "<CORSConfiguration><CORSRule>",
    ...origins.map((origin) => `<AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>`),
    "<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod>",
    "<AllowedHeader>content-type</AllowedHeader>",
    "<MaxAgeSeconds>600</MaxAgeSeconds>",
    "</CORSRule></CORSConfiguration>",
  ].join("");
}

/** Origins of the web app, from a comma-separated list of its URLs. */
export function webOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => new URL(item).origin);
}

/** Replaces the bucket's CORS rules. Run once per environment, and again when the web URL changes. */
export async function applyBucketCors(config: S3Config, origins: readonly string[]) {
  if (origins.length === 0) throw new Error("No web origin given.");
  const body = bucketCorsXml(origins);
  const response = await fetch(
    presignS3Url(config, { expiresIn: 60, key: "", method: "PUT", subresource: "cors" }),
    {
      body,
      headers: {
        "content-md5": createHash("md5").update(body).digest("base64"),
        "content-type": "application/xml",
      },
      method: "PUT",
    },
  );
  if (!response.ok) {
    throw new Error(`The storage answered ${response.status} to the CORS update.`);
  }
}
