import * as z from "zod";

import { organizationRecordTimestampsSchema } from "./internal.ts";
import { currencyCodeSchema } from "./money.ts";

export const organizationUnitStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const organizationNameSchema = z.string().trim().min(2).max(160);

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const outletCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/);

export const timezoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/)
  .refine(
    (timezone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Zona waktu IANA tidak valid." },
  );

/** Where an outlet is, as printed on a receipt. Belongs to the business, not to a person. */
export const outletAddressSchema = z.string().trim().min(3).max(500);

export const tenantSchema = organizationRecordTimestampsSchema.extend({
  /** Set when the workspace is made; every amount of the business is in it. */
  currency: currencyCodeSchema,
  id: z.uuid(),
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: organizationUnitStatusSchema,
});

export const brandSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: organizationUnitStatusSchema,
});

export const outletSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  brandId: z.uuid(),
  code: outletCodeSchema,
  name: organizationNameSchema,
  timezone: timezoneSchema,
  address: outletAddressSchema.nullable(),
  status: organizationUnitStatusSchema,
});

export const createTenantSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export const updateTenantSchema = z
  .object({
    name: organizationNameSchema.optional(),
    slug: organizationSlugSchema.optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Perubahan tenant wajib diisi." });

export const createBrandSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export const updateBrandSchema = z
  .object({
    name: organizationNameSchema.optional(),
    slug: organizationSlugSchema.optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Perubahan brand wajib diisi." });

export const createOutletSchema = z.object({
  brandId: z.uuid(),
  code: outletCodeSchema,
  name: organizationNameSchema,
  timezone: timezoneSchema.default("Asia/Jakarta"),
  address: outletAddressSchema.optional(),
});

export const updateOutletSchema = z
  .object({
    brandId: z.uuid().optional(),
    code: outletCodeSchema.optional(),
    name: organizationNameSchema.optional(),
    timezone: timezoneSchema.optional(),
    /** Null removes the address. */
    address: outletAddressSchema.nullable().optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Perubahan outlet wajib diisi." });

export const organizationSnapshotSchema = z.object({
  tenant: tenantSchema,
  brands: z.array(brandSchema),
  outlets: z.array(outletSchema),
});

export const workspaceTypeSchema = z.enum(["BUSINESS", "PERSONAL"]);

export const businessTemplateSchema = z.enum([
  "BAKERY_RETAIL",
  "BUSINESS_FINANCE_ONLY",
  "CAFE",
  "CLOUD_KITCHEN",
  "HC_ONLY",
  "PERSONAL",
  "RESTAURANT",
]);

export const workspaceSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: organizationUnitStatusSchema,
  template: businessTemplateSchema,
  type: workspaceTypeSchema,
});

export const businessUnitSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: organizationUnitStatusSchema,
  workspaceId: z.uuid(),
});

export const locationSchema = organizationRecordTimestampsSchema.extend({
  businessUnitId: z.uuid().nullable(),
  code: outletCodeSchema,
  id: z.uuid(),
  name: organizationNameSchema,
  status: organizationUnitStatusSchema,
  timezone: timezoneSchema,
  workspaceId: z.uuid(),
});

export const workspaceStructureSchema = z.object({
  businessUnits: z.array(businessUnitSchema),
  locations: z.array(locationSchema),
  workspace: workspaceSchema,
});

export type Brand = z.infer<typeof brandSchema>;

export type Workspace = z.infer<typeof workspaceSchema>;

export type WorkspaceStructure = z.infer<typeof workspaceStructureSchema>;

export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;

export type CreateBrand = z.infer<typeof createBrandSchema>;

export type CreateOutlet = z.infer<typeof createOutletSchema>;

export type CreateTenant = z.infer<typeof createTenantSchema>;

export type OrganizationSnapshot = z.infer<typeof organizationSnapshotSchema>;

export type OrganizationUnitStatus = z.infer<typeof organizationUnitStatusSchema>;

export type BusinessTemplate = z.infer<typeof businessTemplateSchema>;

export type BusinessUnit = z.infer<typeof businessUnitSchema>;

export type Location = z.infer<typeof locationSchema>;

export type Outlet = z.infer<typeof outletSchema>;

export type Tenant = z.infer<typeof tenantSchema>;

export type UpdateBrand = z.infer<typeof updateBrandSchema>;

export type UpdateOutlet = z.infer<typeof updateOutletSchema>;

export type UpdateTenant = z.infer<typeof updateTenantSchema>;
