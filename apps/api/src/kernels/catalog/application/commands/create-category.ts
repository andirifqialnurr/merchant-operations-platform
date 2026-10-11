import { createCatalogCategorySchema, type CreateCatalogCategory } from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  uniqueMutation,
} from "../catalog-deps.js";
import { toCategory } from "../catalog-mappers.js";

export async function createCategory(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogCategory,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogCategorySchema.parse(input);
  if (await deps.repository.findCategoryBySlug(tenantId, parsed.slug)) {
    throw conflict("CATALOG_CATEGORY_SLUG_CONFLICT", "Category slug is already in use.");
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createCategory(tenantId, parsed, context),
    "CATALOG_CATEGORY_SLUG_CONFLICT",
    "Category slug is already in use.",
  );
  return toCategory(record);
}
