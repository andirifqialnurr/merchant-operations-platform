import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * The key an external system sends to put tickets in a kitchen:
 * `kds_<prefix>_<secret>`. The prefix finds the source and may be shown; the
 * secret is only ever stored as a hash.
 */
const KEY_PATTERN = /^kds_([a-z2-9]{10})_([A-Za-z0-9_-]{43})$/;

/** Letters and digits that are hard to mix up when read off a screen. */
const PREFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PREFIX_LENGTH = 10;

export function hashIntakeSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** A new key. `key` is handed to the person once; the rest is stored. */
export function createIntakeKey() {
  let prefix = "";
  for (let index = 0; index < PREFIX_LENGTH; index += 1) {
    prefix += PREFIX_ALPHABET[randomInt(PREFIX_ALPHABET.length)];
  }
  const secret = randomBytes(32).toString("base64url");
  return { key: `kds_${prefix}_${secret}`, prefix, secretHash: hashIntakeSecret(secret) };
}

/** The key from an `Authorization: Bearer …` header, or undefined. */
export function readIntakeKey(authorization: string | undefined) {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? "");
  const parts = match?.[1] ? KEY_PATTERN.exec(match[1]) : null;
  return parts?.[1] && parts[2] ? { prefix: parts[1], secret: parts[2] } : undefined;
}

/** Compares in constant time, so the answer time says nothing about the secret. */
export function secretMatches(secret: string, storedHash: string) {
  const given = Buffer.from(hashIntakeSecret(secret), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}
