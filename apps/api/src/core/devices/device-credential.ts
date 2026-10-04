import { createHash, randomBytes, randomInt } from "node:crypto";

import { deviceCredentialSchema } from "@merchant/contracts";

/** Separate from the session cookie of the person using the device. */
export const DEVICE_COOKIE_NAME = "merchant_device";

/** Browsers cap cookie lifetimes at about 400 days; the device stays signed in until revoked. */
const DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** Letters and digits that are hard to mix up when read from one screen and typed on another. */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

/** How long a freshly issued activation code can be used. */
export const ACTIVATION_CODE_TTL_MS = 15 * 60 * 1_000;

export function createActivationCode() {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** "K7M29QXT" as people read it aloud: "K7M2-9QXT". */
export function formatActivationCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function createDeviceCredential() {
  return randomBytes(32).toString("base64url");
}

/** Codes and credentials are random and long, so a fast hash is enough to store them. */
export function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function readDeviceCredential(cookieHeader: string | undefined) {
  if (!cookieHeader) return undefined;
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== DEVICE_COOKIE_NAME) continue;
    const parsed = deviceCredentialSchema.safeParse(cookie.slice(separator + 1).trim());
    return parsed.success ? parsed.data : undefined;
  }
  return undefined;
}

export function serializeDeviceCookie(credential: string, secure: boolean) {
  return [
    `${DEVICE_COOKIE_NAME}=${credential}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${DEVICE_COOKIE_MAX_AGE_SECONDS}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function serializeExpiredDeviceCookie(secure: boolean) {
  return [
    `${DEVICE_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
