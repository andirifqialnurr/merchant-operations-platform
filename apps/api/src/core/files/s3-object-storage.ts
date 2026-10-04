import type { ObjectStorage } from "./file-storage.service.js";
import { presignS3Url, type S3Config } from "./s3-presign.js";

type StorageEnvironment = Partial<
  Record<
    | "OBJECT_STORAGE_ACCESS_KEY"
    | "OBJECT_STORAGE_BUCKET"
    | "OBJECT_STORAGE_ENDPOINT"
    | "OBJECT_STORAGE_PUBLIC_ENDPOINT"
    | "OBJECT_STORAGE_REGION"
    | "OBJECT_STORAGE_SECRET_KEY",
    string
  >
>;

/** How long the API's own requests to the storage may be used and may take. */
const INTERNAL_URL_TTL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * An S3-compatible storage reached with signed URLs only, so no SDK is
 * needed. `publicEndpoint` is the address browsers use; it differs from
 * `endpoint` when the API reaches the storage over a private network.
 */
export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly config: S3Config,
    private readonly publicEndpoint: string = config.endpoint,
  ) {}

  private internal(method: "DELETE" | "GET" | "HEAD", key: string) {
    return presignS3Url(this.config, { expiresIn: INTERNAL_URL_TTL_SECONDS, key, method });
  }

  private forBrowser() {
    return { ...this.config, endpoint: this.publicEndpoint };
  }

  signUpload(key: string, contentType: string, sizeBytes: number, expiresIn: number, now: Date) {
    return presignS3Url(this.forBrowser(), {
      expiresIn,
      // Signed, so the storage refuses any other type or size.
      headers: { "content-length": String(sizeBytes), "content-type": contentType },
      key,
      method: "PUT",
      now,
    });
  }

  signRead(key: string, expiresIn: number, now: Date) {
    return presignS3Url(this.forBrowser(), { expiresIn, key, method: "GET", now });
  }

  async head(key: string) {
    const response = await fetch(this.internal("HEAD", key), {
      method: "HEAD",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Object storage answered ${response.status} to HEAD.`);
    return {
      contentType: response.headers.get("content-type"),
      sizeBytes: Number(response.headers.get("content-length") ?? 0),
    };
  }

  async readStart(key: string, length: number) {
    const response = await fetch(this.internal("GET", key), {
      headers: { range: `bytes=0-${length - 1}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Object storage answered ${response.status} to GET.`);
    // A storage that ignores the range sends everything; only the start is kept.
    return new Uint8Array(await response.arrayBuffer()).slice(0, length);
  }

  async remove(key: string) {
    const response = await fetch(this.internal("DELETE", key), {
      method: "DELETE",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Object storage answered ${response.status} to DELETE.`);
    }
  }
}

/** An object storage that is not configured: every use says so, nothing is guessed. */
class MissingObjectStorage implements ObjectStorage {
  private fail(): never {
    throw new Error("Object storage is not configured (OBJECT_STORAGE_* variables).");
  }
  async head(): Promise<never> {
    return this.fail();
  }
  async readStart(): Promise<never> {
    return this.fail();
  }
  async remove(): Promise<never> {
    return this.fail();
  }
  signRead(): never {
    return this.fail();
  }
  signUpload(): never {
    return this.fail();
  }
}

export function createObjectStorage(environment: StorageEnvironment = process.env): ObjectStorage {
  const {
    OBJECT_STORAGE_ACCESS_KEY: accessKey,
    OBJECT_STORAGE_BUCKET: bucket,
    OBJECT_STORAGE_ENDPOINT: endpoint,
    OBJECT_STORAGE_SECRET_KEY: secretKey,
  } = environment;
  if (!accessKey || !bucket || !endpoint || !secretKey) return new MissingObjectStorage();
  return new S3ObjectStorage(
    {
      accessKey,
      bucket,
      endpoint,
      region: environment.OBJECT_STORAGE_REGION ?? "us-east-1",
      secretKey,
    },
    environment.OBJECT_STORAGE_PUBLIC_ENDPOINT ?? endpoint,
  );
}
