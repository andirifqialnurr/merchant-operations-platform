export const CRITICAL_AUDIT_ACTIONS = [
  "catalog_modifier_option.update",
  "catalog_outlet_product.create",
  "catalog_outlet_product.update",
  "catalog_product.create",
  "catalog_product.update",
  "catalog_product_image.update",
  "catalog_product_variant.update",
  "entitlement.override",
  "membership.create",
  "membership.provision_owner",
  "membership.update",
  "outlet.update",
  "role.create",
  "role.update",
  "subscription.replace",
  "tenant.create",
  "tenant.update",
] as const;

type AuditMetadataValue =
  boolean | null | number | string | AuditMetadata | readonly AuditMetadataValue[];

export type AuditMetadata = { [key: string]: AuditMetadataValue };

const criticalActions = new Set<string>(CRITICAL_AUDIT_ACTIONS);
const sensitiveMetadataKeyPattern =
  /(?:authorization|cookie|password|raw|secret|session|signature|token|webhook)/i;

export function isCriticalAuditAction(action: string) {
  return criticalActions.has(action);
}

function toSafeAuditMetadataValue(value: unknown, path: string[] = []): AuditMetadataValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => toSafeAuditMetadataValue(item, [...path, String(index)]));
  }

  if (value && typeof value === "object") {
    const metadata: AuditMetadata = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        continue;
      }

      const keyPath = [...path, key];
      if (sensitiveMetadataKeyPattern.test(key)) {
        throw new Error(`Sensitive audit metadata key rejected: ${keyPath.join(".")}`);
      }
      metadata[key] = toSafeAuditMetadataValue(item, keyPath);
    }

    return metadata;
  }

  throw new Error(`Unsupported audit metadata value at ${path.join(".") || "metadata"}`);
}

function toSafeAuditMetadata(payload: Record<string, unknown>): AuditMetadata {
  const metadata: AuditMetadata = {};

  for (const [key, item] of Object.entries(payload)) {
    const keyPath = [key];
    if (sensitiveMetadataKeyPattern.test(key)) {
      throw new Error(`Sensitive audit metadata key rejected: ${keyPath.join(".")}`);
    }
    metadata[key] = toSafeAuditMetadataValue(item, keyPath);
  }

  return metadata;
}

export function buildAuditPayload(payload: Record<string, unknown>): AuditMetadata {
  return toSafeAuditMetadata(payload);
}

export function buildAuditMetadata(
  action: string,
  payload: Record<string, unknown>,
): AuditMetadata {
  const metadata = buildAuditPayload(payload);

  if (!isCriticalAuditAction(action)) {
    return metadata;
  }

  return { ...metadata, critical: true };
}
