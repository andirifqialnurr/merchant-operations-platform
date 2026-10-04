import { deviceCredentialSchema, type Device } from "@merchant/contracts";

/**
 * What the rest of the API needs to know about the device a request comes
 * from, without importing `core/devices`: the cookie it sends and a way to
 * check it. `core/devices` provides the authenticator for the whole application.
 */

/** Separate from the session cookie of the person using the device. */
export const DEVICE_COOKIE_NAME = "merchant_device";

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

export interface DeviceAuthenticator {
  /** The active device that holds this credential, or undefined. Never throws. */
  authenticate(credential: string | undefined): Promise<Device | undefined>;
}

export const DEVICE_AUTHENTICATOR = Symbol("DEVICE_AUTHENTICATOR");
