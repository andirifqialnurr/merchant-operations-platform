import { randomUUID } from "node:crypto";

import type { FilePurpose, PermissionKey } from "@merchant/contracts";
import { PERMISSIONS } from "@merchant/contracts";

/** What may be uploaded for each purpose (security.md 12). */
export type FilePolicy = {
  /** Folder under the workspace's own prefix. */
  folder: string;
  maxBytes: number;
  /** Who may upload for this purpose. */
  permission: PermissionKey;
  /** Raster images only: a vector image can carry scripts. */
  types: Readonly<Record<string, string>>;
};

export const FILE_POLICIES: Record<FilePurpose, FilePolicy> = {
  CATALOG_PRODUCT_IMAGE: {
    folder: "catalog/product-images",
    maxBytes: 5 * 1024 * 1024,
    permission: PERMISSIONS.catalogManage,
    types: {
      "image/avif": "avif",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
};

/** How long an upload URL can be used. */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;
/** How long a URL for reading a stored file can be used. */
export const READ_URL_TTL_SECONDS = 5 * 60;

/** Everything a workspace stores lives under this prefix and nowhere else. */
export function workspacePrefix(tenantId: string) {
  return `tenants/${tenantId}/`;
}

/**
 * The key of a new object. The server makes it up: nothing in it comes from
 * the file's name, so a name can never steer where the file lands.
 */
export function newObjectKey(tenantId: string, policy: FilePolicy, contentType: string) {
  return `${workspacePrefix(tenantId)}${policy.folder}/${randomUUID()}.${policy.types[contentType]}`;
}

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** True when the key is well formed and inside the workspace's folder for this purpose. */
export function ownsObjectKey(tenantId: string, policy: FilePolicy, key: string) {
  if (key.length > 512 || !KEY_PATTERN.test(key)) return false;
  const segments = key.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }
  return key.startsWith(`${workspacePrefix(tenantId)}${policy.folder}/`);
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

/**
 * The image type the first bytes of a file say it is, or undefined. The
 * declared content type is only a claim; this is what the file really starts with.
 */
export function sniffImageType(bytes: Uint8Array): string | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12))) {
    return "image/avif";
  }
  return undefined;
}

/** How many leading bytes `sniffImageType` needs. */
export const SNIFF_BYTES = 16;
