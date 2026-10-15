import assert from "node:assert/strict";
import test from "node:test";

import { hashQrToken, isQrToken, newQrSalt, qrTokenOf } from "./qr-token.js";

test("a table's QR token is the same every time it is worked out, and only with the secret", () => {
  const salt = newQrSalt();
  const token = qrTokenOf("secret-a", salt);
  assert.equal(token, qrTokenOf("secret-a", salt));
  assert.notEqual(token, qrTokenOf("secret-b", salt));
  assert.notEqual(token, qrTokenOf("secret-a", newQrSalt()));
  assert.ok(isQrToken(token));
  assert.match(hashQrToken(token), /^[a-f0-9]{64}$/);
  // The hash cannot be read back as the token.
  assert.notEqual(hashQrToken(token), token);
});

test("only a token's own shape is looked up", () => {
  assert.equal(isQrToken("x".repeat(43)), true);
  assert.equal(isQrToken("x".repeat(42)), false);
  assert.equal(isQrToken("../../etc/passwd" + "x".repeat(27)), false);
});
