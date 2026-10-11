import { updateCatalogCategorySchema, type UpdateCatalogCategory } from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireCategory,
  uniqueMutation,
} from "../catalog-deps.js";
import { toCategory } from "../catalog-mappers.js";

export async function updateCategory(
  deps: CatalogDeps,
  tenantId: string,
  categoryId: string,
  input: UpdateCatalogCategory,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await requireCategory(deps, tenantId, categoryId);
  const parsed = updateCatalogCategorySchema.parse(input);
  if (parsed.slug && parsed.slug !== current.slug) {
    const duplicate = await deps.repository.findCategoryBySlug(tenantId, parsed.slug);
    if (duplicate && duplicate.id !== categoryId) {
      throw conflict("CATALOG_CATEGORY_SLUG_CONFLICT", "Category slug is already in use.");
    }
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.updateCategory(tenantId, categoryId, parsed, context),
    "CATALOG_CATEGORY_SLUG_CONFLICT",
    "Category slug is already in use.",
  );
  return toCategory(record);
}
