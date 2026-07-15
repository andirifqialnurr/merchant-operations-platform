export const themeOptions = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof themeOptions)[number];

export const themeStorageKey = "merchant-operations-theme";

export const themePersistenceContract = {
  temporary: {
    scope: "browser-local",
    storageKey: themeStorageKey,
  },
  backoffice: {
    scope: "user",
    identityKey: "userId",
  },
  platformAdmin: {
    scope: "user",
    identityKey: "userId",
  },
  pos: {
    scope: "device",
    identityKey: "deviceId",
  },
  kds: {
    scope: "device",
    identityKey: "deviceId",
  },
  customerStorefront: {
    scope: "system-default",
    identityKey: null,
  },
} as const;
