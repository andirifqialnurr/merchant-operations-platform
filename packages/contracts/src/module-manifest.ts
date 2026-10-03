import * as z from "zod";

import { uniquePermissions, uniqueStrings } from "./internal.ts";
import { organizationNameSchema, workspaceTypeSchema } from "./organization.ts";
import { moduleKeySchema, moduleTierSchema } from "./entitlement.ts";
import { permissionKeySchema } from "./access.ts";

export const capabilityKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);

export const moduleManifestVersionSchema = z
  .string()
  .trim()
  .regex(/^[0-9]+(?:\.[0-9]+){0,2}$/);

export const moduleRouteRegistrationSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/),
  permissionKey: permissionKeySchema.optional(),
});

export const moduleNavigationRegistrationSchema = z.object({
  label: organizationNameSchema,
  path: moduleRouteRegistrationSchema.shape.path,
  permissionKey: permissionKeySchema.optional(),
});

export const moduleSettingRegistrationSchema = z.object({
  key: capabilityKeySchema,
  label: organizationNameSchema,
  permissionKey: permissionKeySchema.optional(),
});

export const moduleEventTypeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(6)
  .max(160)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\.v[1-9][0-9]*$/);

export const moduleEventHandlerRegistrationSchema = z.object({
  eventType: moduleEventTypeSchema,
  handlerKey: capabilityKeySchema,
});

export const moduleInstallStepSchema = z.object({
  key: capabilityKeySchema,
  label: organizationNameSchema,
  required: z.boolean().default(true),
});

export const moduleManifestSchema = z
  .object({
    capabilities: z.array(capabilityKeySchema).refine(uniqueStrings, {
      message: "Capability tidak boleh duplikat.",
    }),
    /**
     * The tier at which a capability starts; higher tiers inherit it. A
     * capability that is not listed here starts at Basic.
     */
    capabilityTiers: z.record(capabilityKeySchema, moduleTierSchema).default({}),
    configSchemaVersion: z.number().int().min(1),
    displayName: organizationNameSchema,
    eventHandlers: z.array(moduleEventHandlerRegistrationSchema),
    eventsProduced: z.array(moduleEventTypeSchema).refine(uniqueStrings, {
      message: "Event produced tidak boleh duplikat.",
    }),
    installSteps: z.array(moduleInstallStepSchema),
    internalDependencies: z.array(moduleKeySchema).refine(uniqueStrings, {
      message: "Dependency module tidak boleh duplikat.",
    }),
    key: moduleKeySchema,
    /** Usage dimensions this module is limited by, e.g. "pos.registers.active". */
    limitDimensions: z
      .array(capabilityKeySchema)
      .refine(uniqueStrings, { message: "Limit dimension must not repeat." })
      .default([]),
    /**
     * First segment of the capability and limit keys this module owns, e.g.
     * "pos". When given, every key the manifest declares must use one of them.
     */
    namespaces: z
      .array(z.string().regex(/^[a-z][a-z0-9_]*$/))
      .refine(uniqueStrings, { message: "Namespace must not repeat." })
      .default([]),
    navigation: z.array(moduleNavigationRegistrationSchema),
    permissions: z.array(permissionKeySchema).refine(uniquePermissions, {
      message: "Permission tidak boleh duplikat.",
    }),
    routes: z.array(moduleRouteRegistrationSchema),
    settings: z.array(moduleSettingRegistrationSchema),
    supportedWorkspaceTypes: z.array(workspaceTypeSchema).min(1).refine(uniqueStrings, {
      message: "Workspace type tidak boleh duplikat.",
    }),
    version: moduleManifestVersionSchema,
  })
  .refine((value) => !value.internalDependencies.includes(value.key), {
    message: "Module tidak boleh bergantung pada dirinya sendiri.",
    path: ["internalDependencies"],
  })
  .refine(
    (value) => Object.keys(value.capabilityTiers).every((key) => value.capabilities.includes(key)),
    {
      message: "A tier is given for a capability the module does not declare.",
      path: ["capabilityTiers"],
    },
  )
  .refine(
    (value) =>
      value.namespaces.length === 0 ||
      [...value.capabilities, ...value.limitDimensions].every((key) =>
        value.namespaces.includes(key.slice(0, key.indexOf("."))),
      ),
    {
      message: "A capability or limit key is outside the module's namespaces.",
      path: ["namespaces"],
    },
  );

export const moduleInstallationStatusSchema = z.enum([
  "ACTIVE",
  "ERROR",
  "NOT_INSTALLED",
  "PROVISIONING",
  "SETUP_REQUIRED",
  "SUSPENDED",
]);

export const moduleInstallationSchema = z
  .object({
    activatedAt: z.iso.datetime().nullable(),
    configSchemaVersion: z.number().int().min(1),
    errorMessage: z.string().trim().min(1).max(500).nullable(),
    moduleKey: moduleKeySchema,
    provisionedAt: z.iso.datetime().nullable(),
    setupRequiredReason: z.string().trim().min(1).max(500).nullable(),
    status: moduleInstallationStatusSchema,
    suspendedReason: z.string().trim().min(1).max(500).nullable(),
    updatedAt: z.iso.datetime(),
    workspaceId: z.uuid(),
  })
  .strict()
  .refine((value) => value.status !== "ACTIVE" || value.activatedAt !== null, {
    message: "Installation ACTIVE wajib memiliki activatedAt.",
    path: ["activatedAt"],
  })
  .refine((value) => value.status !== "SETUP_REQUIRED" || value.setupRequiredReason !== null, {
    message: "Installation SETUP_REQUIRED wajib memiliki setupRequiredReason.",
    path: ["setupRequiredReason"],
  });

export const moduleInstallationParamsSchema = z.object({ moduleKey: moduleKeySchema });

/** Every commercial module a workspace is entitled to or has installed. */
export const moduleInstallationListSchema = z.object({
  installations: z.array(moduleInstallationSchema),
});

export const integrationBindingStatusSchema = z.enum([
  "ACTIVE",
  "DISABLED",
  "DRAFT",
  "ERROR",
  "PAUSED",
  "SETUP_REQUIRED",
]);

export const integrationBindingHealthSchema = z.enum(["BLOCKED", "HEALTHY", "STALE"]);

export const integrationBindingSchema = z
  .object({
    auditReason: z.string().trim().min(1).max(500).nullable(),
    configSchemaVersion: z.number().int().min(1),
    effectiveFrom: z.iso.datetime(),
    effectiveTo: z.iso.datetime().nullable(),
    eventType: moduleEventTypeSchema,
    handlerKey: capabilityKeySchema,
    health: integrationBindingHealthSchema,
    id: z.uuid(),
    lastError: z.string().trim().min(1).max(500).nullable(),
    sourceModuleKey: moduleKeySchema,
    status: integrationBindingStatusSchema,
    targetModuleKey: moduleKeySchema,
    updatedAt: z.iso.datetime(),
    workspaceId: z.uuid(),
  })
  .strict()
  .refine((value) => value.sourceModuleKey !== value.targetModuleKey, {
    message: "Integration binding wajib menghubungkan dua module berbeda.",
    path: ["targetModuleKey"],
  })
  .refine((value) => value.status !== "ERROR" || value.lastError !== null, {
    message: "Binding ERROR wajib memiliki lastError.",
    path: ["lastError"],
  });

export const moduleBoundaryAccessTypeSchema = z.enum([
  "EVENT_REACTION",
  "INTERNAL_DEPENDENCY",
  "PUBLIC_FACADE",
  "READ_MODEL",
]);

export const moduleBoundaryRuleSchema = z
  .object({
    accessType: moduleBoundaryAccessTypeSchema,
    allowedDependencyKeys: z.array(moduleKeySchema).refine(uniqueStrings, {
      message: "Allowed dependency tidak boleh duplikat.",
    }),
    forbiddenRepositoryWriteKeys: z.array(moduleKeySchema).refine(uniqueStrings, {
      message: "Forbidden repository write tidak boleh duplikat.",
    }),
    ownerModuleKey: moduleKeySchema,
    publicFacadeKeys: z.array(capabilityKeySchema).refine(uniqueStrings, {
      message: "Public facade key tidak boleh duplikat.",
    }),
    reason: z.string().trim().min(10).max(500),
  })
  .strict()
  .refine((value) => !value.allowedDependencyKeys.includes(value.ownerModuleKey), {
    message: "Owner module tidak perlu menjadi dependency dirinya sendiri.",
    path: ["allowedDependencyKeys"],
  })
  .refine((value) => !value.forbiddenRepositoryWriteKeys.includes(value.ownerModuleKey), {
    message: "Owner module boleh menulis repository miliknya sendiri.",
    path: ["forbiddenRepositoryWriteKeys"],
  });

export type CapabilityKey = z.infer<typeof capabilityKeySchema>;

export type ModuleEventHandlerRegistration = z.infer<typeof moduleEventHandlerRegistrationSchema>;

export type ModuleEventType = z.infer<typeof moduleEventTypeSchema>;

export type ModuleInstallStep = z.infer<typeof moduleInstallStepSchema>;

export type ModuleInstallation = z.infer<typeof moduleInstallationSchema>;

export type ModuleInstallationList = z.infer<typeof moduleInstallationListSchema>;

export type ModuleInstallationStatus = z.infer<typeof moduleInstallationStatusSchema>;

export type IntegrationBinding = z.infer<typeof integrationBindingSchema>;

export type IntegrationBindingHealth = z.infer<typeof integrationBindingHealthSchema>;

export type IntegrationBindingStatus = z.infer<typeof integrationBindingStatusSchema>;

export type ModuleBoundaryAccessType = z.infer<typeof moduleBoundaryAccessTypeSchema>;

export type ModuleBoundaryRule = z.infer<typeof moduleBoundaryRuleSchema>;

export type ModuleManifest = z.infer<typeof moduleManifestSchema>;

export type ModuleNavigationRegistration = z.infer<typeof moduleNavigationRegistrationSchema>;

export type ModuleRouteRegistration = z.infer<typeof moduleRouteRegistrationSchema>;

export type ModuleSettingRegistration = z.infer<typeof moduleSettingRegistrationSchema>;
