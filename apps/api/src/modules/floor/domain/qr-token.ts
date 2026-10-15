import { createHash, createHmac, randomBytes } from "node:crypto";

/** A QR token: 32 bytes in base64url, nothing else. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** A fresh random salt for a new QR version, 16 bytes in hex. */
export function newQrSalt() {
  return randomBytes(16).toString("hex");
}

/**
 * The token printed in a table's QR. It is worked out from the salt with the
 * server's secret, so it can be printed again later without ever being stored.
 */
export function qrTokenOf(secret: string, salt: string) {
  return createHmac("sha256", secret).update(`table-qr:${salt}`).digest("base64url");
}

/** What the database keeps to find a token. */
export function hashQrToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isQrToken(value: string) {
  return TOKEN_SHAPE.test(value);
}
