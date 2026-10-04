/**
 * Lets the web app's browsers upload to signed URLs and read images:
 *   pnpm --filter @merchant/api storage:cors
 * Reads WEB_URL (one URL, or several separated by commas) and OBJECT_STORAGE_*.
 */
import { applyBucketCors, webOrigins } from "../core/files/public.js";

const {
  OBJECT_STORAGE_ACCESS_KEY: accessKey,
  OBJECT_STORAGE_BUCKET: bucket,
  OBJECT_STORAGE_ENDPOINT: endpoint,
  OBJECT_STORAGE_SECRET_KEY: secretKey,
} = process.env;

if (!accessKey || !bucket || !endpoint || !secretKey) {
  console.error("Set OBJECT_STORAGE_ENDPOINT, _BUCKET, _ACCESS_KEY, and _SECRET_KEY first.");
  process.exit(1);
}
const origins = webOrigins(process.env.WEB_URL);
if (origins.length === 0) {
  console.error("Set WEB_URL to the address of the web app first.");
  process.exit(1);
}

await applyBucketCors(
  {
    accessKey,
    bucket,
    endpoint,
    region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1",
    secretKey,
  },
  origins,
);
console.log(`Browsers at ${origins.join(", ")} may now upload to and read from the bucket.`);
