import * as z from "zod";

export const authLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(128),
});

export const userLocaleSchema = z.enum(["id", "en"]);

export const userThemeSchema = z.enum(["light", "dark", "system"]);

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(160),
  /** Null until the user picks one; the browser language applies meanwhile. */
  locale: userLocaleSchema.nullable(),
  /** Null until the user picks one; the system theme applies meanwhile. */
  theme: userThemeSchema.nullable(),
});

/** What the user may change about how the app looks to them. */
export const updateUserPreferencesSchema = z
  .object({ locale: userLocaleSchema.optional(), theme: userThemeSchema.optional() })
  .refine((value) => value.locale !== undefined || value.theme !== undefined, {
    message: "Choose a language or a theme.",
  });

export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;

export type UserLocale = z.infer<typeof userLocaleSchema>;

export type UserTheme = z.infer<typeof userThemeSchema>;

export const authSessionSchema = z.object({
  expiresAt: z.iso.datetime(),
  user: authUserSchema,
});

export const authLogoutResponseSchema = z.object({
  success: z.literal(true),
});

export const sessionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;

export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;

export type AuthSession = z.infer<typeof authSessionSchema>;

export type AuthUser = z.infer<typeof authUserSchema>;
