import { sessionTokenSchema } from "@merchant/contracts";

export const SESSION_COOKIE_NAME = "merchant_session";

export function readSessionToken(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex < 0 || cookie.slice(0, separatorIndex).trim() !== SESSION_COOKIE_NAME) {
      continue;
    }

    const result = sessionTokenSchema.safeParse(cookie.slice(separatorIndex + 1).trim());
    return result.success ? result.data : undefined;
  }

  return undefined;
}

export function serializeSessionCookie(token: string, expiresAt: Date, secure: boolean) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${maxAge}`,
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function serializeExpiredSessionCookie(secure: boolean) {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
