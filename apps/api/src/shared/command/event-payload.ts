/**
 * What may go into an outbox event (security.md 6): facts other modules need
 * to react, by ID and by value. Events are copied to every handler, kept for
 * replay, and may leave the process, so they carry no secrets, no personal
 * data, and no text a person typed freely.
 */

type EventPayloadValue =
  boolean | null | number | string | EventPayload | readonly EventPayloadValue[];

export type EventPayload = { [key: string]: EventPayloadValue };

/** Credentials and raw provider data. A key with one of these words is a mistake in the code. */
const SECRET_WORDS = new Set([
  "authorization",
  "cookie",
  "credential",
  "credentials",
  "cvv",
  "otp",
  "password",
  "pin",
  "raw",
  "secret",
  "session",
  "signature",
  "token",
  "webhook",
]);

/** Data about a person. Handlers that need it read it from the owner by ID. */
const PERSONAL_WORDS = new Set([
  "address",
  "birth",
  "birthday",
  "email",
  "ktp",
  "nik",
  "npwp",
  "passport",
  "phone",
]);
const PERSONAL_NAMES = ["customername", "firstname", "fullname", "lastname"];

/**
 * Text a person typed freely can contain anything, including someone's name
 * or number. It stays in the audit trail and is left out of the event.
 */
const FREE_TEXT_WORDS = new Set(["comment", "note", "notes", "reason"]);

/** "customerPhone" and "customer_phone" both become ["customer", "phone"]. */
function wordsOf(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

type KeyKind = "allowed" | "free_text" | "personal" | "secret";

export function eventPayloadKeyKind(key: string): KeyKind {
  const words = wordsOf(key);
  if (words.some((word) => SECRET_WORDS.has(word))) return "secret";
  const joined = words.join("");
  if (
    words.some((word) => PERSONAL_WORDS.has(word)) ||
    PERSONAL_NAMES.some((name) => joined.includes(name))
  ) {
    return "personal";
  }
  if (words.some((word) => FREE_TEXT_WORDS.has(word))) return "free_text";
  return "allowed";
}

function safeValue(value: unknown, path: string[]): EventPayloadValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return value.map((item, index) => safeValue(item, [...path, String(index)]));
  }
  if (value && typeof value === "object") return safeObject(value as Record<string, unknown>, path);
  throw new Error(`Unsupported event payload value at ${path.join(".") || "payload"}`);
}

function safeObject(value: Record<string, unknown>, path: string[]): EventPayload {
  const safe: EventPayload = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const kind = eventPayloadKeyKind(key);
    // Never the value in the message: it is the thing that must not leak.
    if (kind === "secret" || kind === "personal") {
      throw new Error(`Event payload key rejected (${kind}): ${[...path, key].join(".")}`);
    }
    if (kind === "free_text") continue;
    safe[key] = safeValue(item, [...path, key]);
  }
  return safe;
}

/**
 * The payload as it is stored in the outbox. Throws for a secret or personal
 * key, so the mistake fails the transaction instead of leaking; drops
 * free-text keys.
 */
export function safeEventPayload(payload: Record<string, unknown>): EventPayload {
  return safeObject(payload, []);
}
