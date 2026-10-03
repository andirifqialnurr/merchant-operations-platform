import * as z from "zod";

import type { PermissionKey } from "./access.ts";

export const organizationRecordTimestampsSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const uniqueIds = (values: string[]) => new Set(values).size === values.length;

export const uniquePermissions = (values: PermissionKey[]) =>
  new Set(values).size === values.length;

export const uniqueStrings = (values: string[]) => new Set(values).size === values.length;
