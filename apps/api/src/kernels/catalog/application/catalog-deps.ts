import { ConflictException, NotFoundException } from "@nestjs/common";
import { type CatalogRepository } from "./catalog.repository.js";
import { type LimitGate } from "../../../shared/limits/limit-gate.js";
import type { FileStorageService } from "../../../core/files/public.js";

/** The part of file storage the catalog needs. */
export type ProductImageFiles = Pick<FileStorageService, "readUrl" | "verifyUpload">;

export const notFound = (code: string, message: string) => new NotFoundException({ code, message });

export const conflict = (code: string, message: string) => new ConflictException({ code, message });

export function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** What every catalog use case works with. */
export type CatalogDeps = {
  /** Left out only by unit tests that are not about pictures. */
  files?: ProductImageFiles | undefined;
  limits: LimitGate;
  repository: CatalogRepository;
};

/* Checks shared by the use cases: the thing exists in this workspace, and is in use. */

export async function requireTenant(deps: CatalogDeps, tenantId: string) {
  const tenant = await deps.repository.findTenant(tenantId);
  if (!tenant) throw notFound("TENANT_NOT_FOUND", "Tenant was not found.");
  return tenant;
}

export async function requireActiveTenant(deps: CatalogDeps, tenantId: string) {
  const tenant = await requireTenant(deps, tenantId);
  if (tenant.status !== "ACTIVE") throw conflict("TENANT_INACTIVE", "Tenant is inactive.");
  return tenant;
}

export async function requireOutlet(deps: CatalogDeps, tenantId: string, outletId: string) {
  const outlet = await deps.repository.findOutlet(tenantId, outletId);
  if (!outlet) {
    throw notFound("OUTLET_NOT_FOUND", "Outlet was not found in this tenant.");
  }
  return outlet;
}

export async function requireActiveOutlet(deps: CatalogDeps, tenantId: string, outletId: string) {
  const outlet = await requireOutlet(deps, tenantId, outletId);
  if (outlet.status !== "ACTIVE") throw conflict("OUTLET_INACTIVE", "Outlet is inactive.");
  return outlet;
}

export async function requireCategory(deps: CatalogDeps, tenantId: string, categoryId: string) {
  const category = await deps.repository.findCategoryById(tenantId, categoryId);
  if (!category) {
    throw notFound("CATALOG_CATEGORY_NOT_FOUND", "Category was not found in this tenant.");
  }
  return category;
}

export async function requireActiveCategory(
  deps: CatalogDeps,
  tenantId: string,
  categoryId: string,
) {
  const category = await requireCategory(deps, tenantId, categoryId);
  if (category.status !== "ACTIVE") {
    throw conflict("CATALOG_CATEGORY_INACTIVE", "Category is inactive.");
  }
  return category;
}

export async function requireProduct(deps: CatalogDeps, tenantId: string, productId: string) {
  const product = await deps.repository.findProductById(tenantId, productId);
  if (!product) {
    throw notFound("CATALOG_PRODUCT_NOT_FOUND", "Product was not found in this tenant.");
  }
  return product;
}

export async function requireActiveProduct(deps: CatalogDeps, tenantId: string, productId: string) {
  const product = await requireProduct(deps, tenantId, productId);
  if (product.status !== "ACTIVE") {
    throw conflict("CATALOG_PRODUCT_INACTIVE", "Product is inactive.");
  }
  return product;
}

export async function requireModifierGroup(deps: CatalogDeps, tenantId: string, groupId: string) {
  const group = await deps.repository.findModifierGroupById(tenantId, groupId);
  if (!group) {
    throw notFound(
      "CATALOG_MODIFIER_GROUP_NOT_FOUND",
      "Modifier group was not found in this tenant.",
    );
  }
  return group;
}

export async function requireActiveModifierGroup(
  deps: CatalogDeps,
  tenantId: string,
  groupId: string,
) {
  const group = await requireModifierGroup(deps, tenantId, groupId);
  if (group.status !== "ACTIVE") {
    throw conflict("CATALOG_MODIFIER_GROUP_INACTIVE", "Modifier group is inactive.");
  }
  return group;
}

export async function uniqueMutation<T>(
  _deps: CatalogDeps,
  operation: () => Promise<T>,
  code: string,
  message: string,
) {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw conflict(code, message);
    throw error;
  }
}
