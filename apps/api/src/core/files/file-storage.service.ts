import {
  fileUploadRequestSchema,
  fileUploadTicketSchema,
  type FilePurpose,
  type FileUploadRequest,
} from "@merchant/contracts";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";

import {
  FILE_POLICIES,
  newObjectKey,
  ownsObjectKey,
  READ_URL_TTL_SECONDS,
  SNIFF_BYTES,
  sniffImageType,
  UPLOAD_URL_TTL_SECONDS,
} from "./file-policy.js";

/** The few things the API asks of an object storage. */
export interface ObjectStorage {
  /** Size and declared type of a stored object, or null when it does not exist. */
  head(key: string): Promise<{ contentType: string | null; sizeBytes: number } | null>;
  /** The first `length` bytes of an object. */
  readStart(key: string, length: number): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
  signRead(key: string, expiresIn: number, now: Date): string;
  /** A URL that accepts one upload of exactly this type and size. */
  signUpload(
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresIn: number,
    now: Date,
  ): string;
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

export type StoredFile = { contentType: string; objectKey: string; sizeBytes: number };

function invalid(code: string, message: string) {
  return new BadRequestException({ code, message });
}

function notFound() {
  return new NotFoundException({ code: "FILE_NOT_FOUND", message: "The file was not found." });
}

/**
 * Uploads go straight from the browser to the object storage through a
 * signed URL (security.md 12). The API decides the key, the type, and the
 * size before the upload, and checks what really arrived before a file is used.
 */
@Injectable()
export class FileStorageService {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  /** The permission a person needs to upload for this purpose. */
  permissionFor(purpose: FilePurpose) {
    return FILE_POLICIES[purpose].permission;
  }

  /** Step one: a URL for one upload of the stated type and size. */
  createUpload(tenantId: string, input: FileUploadRequest, now = new Date()) {
    const parsed = fileUploadRequestSchema.parse(input);
    const policy = FILE_POLICIES[parsed.purpose];
    if (!(parsed.contentType in policy.types)) {
      throw invalid("FILE_TYPE_NOT_ALLOWED", "This file type is not allowed here.");
    }
    if (parsed.sizeBytes > policy.maxBytes) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        details: { maxBytes: String(policy.maxBytes) },
        message: "The file is too large.",
      });
    }
    const objectKey = newObjectKey(tenantId, policy, parsed.contentType);
    return fileUploadTicketSchema.parse({
      expiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SECONDS * 1_000).toISOString(),
      headers: { "Content-Type": parsed.contentType },
      method: "PUT",
      objectKey,
      uploadUrl: this.storage.signUpload(
        objectKey,
        parsed.contentType,
        parsed.sizeBytes,
        UPLOAD_URL_TTL_SECONDS,
        now,
      ),
    });
  }

  /**
   * Step two, before a file is attached to anything: the object must be in
   * this workspace's folder, exist, be small enough, and really be an image
   * of an allowed type. A file that fails is removed.
   */
  async verifyUpload(
    tenantId: string,
    purpose: FilePurpose,
    objectKey: string,
  ): Promise<StoredFile> {
    const policy = FILE_POLICIES[purpose];
    // Another workspace's key, or a made-up one, looks exactly like a missing file.
    if (!ownsObjectKey(tenantId, policy, objectKey)) throw notFound();

    const stored = await this.reach(() => this.storage.head(objectKey));
    if (!stored) throw notFound();

    const reject = async (code: string, message: string) => {
      await this.storage.remove(objectKey).catch(() => undefined);
      return invalid(code, message);
    };
    if (stored.sizeBytes > policy.maxBytes || stored.sizeBytes === 0) {
      throw await reject("FILE_TOO_LARGE", "The file is empty or too large.");
    }
    const actual = sniffImageType(
      await this.reach(() => this.storage.readStart(objectKey, SNIFF_BYTES)),
    );
    if (!actual || !(actual in policy.types)) {
      throw await reject("FILE_TYPE_NOT_ALLOWED", "The file is not an image of an allowed type.");
    }
    return { contentType: actual, objectKey, sizeBytes: stored.sizeBytes };
  }

  /** A short-lived URL for showing a stored file. Only for the workspace that owns it. */
  readUrl(tenantId: string, purpose: FilePurpose, objectKey: string, now = new Date()) {
    if (!ownsObjectKey(tenantId, FILE_POLICIES[purpose], objectKey)) throw notFound();
    return this.storage.signRead(objectKey, READ_URL_TTL_SECONDS, now);
  }

  private async reach<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch {
      // Nothing about the storage (address, bucket, credentials) goes into the answer.
      throw new HttpException(
        { code: "FILE_STORAGE_UNAVAILABLE", message: "File storage cannot be reached right now." },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
