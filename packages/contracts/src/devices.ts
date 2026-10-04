import * as z from "zod";

/** What a registered device is used for; it decides which surface opens on it. */
export const deviceModeSchema = z.enum(["KDS", "POS"]);

/**
 * PENDING: registered, waiting for its activation code to be entered on the device.
 * ACTIVE: the device holds a credential and may connect.
 * REVOKED: the credential no longer works; the row is kept for the audit trail.
 */
export const deviceStatusSchema = z.enum(["ACTIVE", "PENDING", "REVOKED"]);

export const deviceLabelSchema = z.string().trim().min(2).max(80);

/**
 * The one-time code typed on the device. Letters and digits that are hard to
 * mix up; case and separators are ignored.
 */
export const deviceActivationCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[2-9A-HJ-NP-Z]{8}$/));

/** The secret a device keeps after activation. Never stored or shown by the server again. */
export const deviceCredentialSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const deviceSchema = z.object({
  activatedAt: z.iso.datetime().nullable(),
  /** Set while the device waits for its code; the code stops working after this. */
  activationExpiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  label: deviceLabelSchema,
  lastSeenAt: z.iso.datetime().nullable(),
  mode: deviceModeSchema,
  outletId: z.uuid(),
  revokedAt: z.iso.datetime().nullable(),
  status: deviceStatusSchema,
  workspaceId: z.uuid(),
});

export const deviceListSchema = z.object({ devices: z.array(deviceSchema) });

export const registerDeviceSchema = z.object({
  label: deviceLabelSchema,
  mode: deviceModeSchema,
  outletId: z.uuid(),
});

/** The only response that carries the activation code. It cannot be read again. */
export const deviceActivationTicketSchema = z.object({
  /** Formatted for reading aloud, e.g. "K7M2-9QXT". */
  activationCode: z.string().regex(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/),
  device: deviceSchema,
});

export const activateDeviceSchema = z.object({ code: deviceActivationCodeSchema });

export const deviceParamsSchema = z.object({ deviceId: z.uuid() });

export type ActivateDevice = z.infer<typeof activateDeviceSchema>;

export type Device = z.infer<typeof deviceSchema>;

export type DeviceActivationTicket = z.infer<typeof deviceActivationTicketSchema>;

export type DeviceList = z.infer<typeof deviceListSchema>;

export type DeviceMode = z.infer<typeof deviceModeSchema>;

export type DeviceParams = z.infer<typeof deviceParamsSchema>;

export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

export type RegisterDevice = z.infer<typeof registerDeviceSchema>;
