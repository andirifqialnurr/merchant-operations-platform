import { argon2, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ARGON2_MEMORY_KIB = 65_536;
const ARGON2_PARALLELISM = 1;
const ARGON2_PASSES = 3;
const ARGON2_TAG_LENGTH = 32;
const PASSWORD_HASH_PREFIX = "argon2id$v=1";

function derivePassword(password: string, nonce: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    argon2(
      "argon2id",
      {
        memory: ARGON2_MEMORY_KIB,
        message: password,
        nonce,
        parallelism: ARGON2_PARALLELISM,
        passes: ARGON2_PASSES,
        tagLength: ARGON2_TAG_LENGTH,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const nonce = randomBytes(16);
  const derivedKey = await derivePassword(password, nonce);

  return [
    PASSWORD_HASH_PREFIX,
    `m=${ARGON2_MEMORY_KIB},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}`,
    nonce.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, version, parameters, encodedNonce, encodedDerivedKey] = encodedHash.split("$");

  if (
    `${algorithm ?? ""}$${version ?? ""}` !== PASSWORD_HASH_PREFIX ||
    parameters !== `m=${ARGON2_MEMORY_KIB},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}` ||
    !encodedNonce ||
    !encodedDerivedKey
  ) {
    return false;
  }

  try {
    const expectedKey = Buffer.from(encodedDerivedKey, "base64url");
    const actualKey = await derivePassword(password, Buffer.from(encodedNonce, "base64url"));

    return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
