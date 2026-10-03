import * as z from "zod";

import { authLoginRequestSchema } from "./auth.ts";

export const PLATFORM_PERMISSIONS = {
  docsRead: "platform.docs.read",
  subscriptionManage: "platform.subscription.manage",
  subscriptionRead: "platform.subscription.read",
  supportAccess: "platform.support.access",
  tenantManage: "platform.tenant.manage",
  tenantRead: "platform.tenant.read",
} as const;

export const platformRoleSchema = z.enum(["OWNER", "ADMIN", "SUPPORT"]);

export const platformPermissionKeySchema = z.enum(Object.values(PLATFORM_PERMISSIONS));

export const platformUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(160),
  role: platformRoleSchema,
  permissionKeys: z.array(platformPermissionKeySchema),
});

export const platformSessionSchema = z.object({
  expiresAt: z.iso.datetime(),
  user: platformUserSchema,
});

export const provisionPlatformUserSchema = authLoginRequestSchema.extend({
  displayName: z.string().trim().min(2).max(160),
  role: platformRoleSchema,
});

export type PlatformPermissionKey = z.infer<typeof platformPermissionKeySchema>;

export type PlatformRole = z.infer<typeof platformRoleSchema>;

export type PlatformSession = z.infer<typeof platformSessionSchema>;

export type PlatformUser = z.infer<typeof platformUserSchema>;

export type ProvisionPlatformUser = z.infer<typeof provisionPlatformUserSchema>;
