import { updateCatalogProductSchema, type UpdateCatalogProduct } from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  notFound,
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveCategory,
  uniqueMutation,
} from "../catalog-deps.js";
import { toProduct } from "../catalog-mappers.js";

export async function updateProduct(
  deps: CatalogDeps,
  tenantId: string,
  productId: string,
  input: UpdateCatalogProduct,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await deps.repository.findProductById(tenantId, productId);
  if (!current) {
    throw notFound("CATALOG_PRODUCT_NOT_FOUND", "Product was not found in this tenant.");
  }
  const parsed = updateCatalogProductSchema.parse(input);
  // Relabelling a recorded price would change what it means.
  if (parsed.currency && parsed.currency !== current.currency) {
    throw conflict(
      "CATALOG_CURRENCY_MISMATCH",
      "A product is priced in the currency of its workspace.",
    );
  }
  if (parsed.categoryId && parsed.categoryId !== current.categoryId) {
    await requireActiveCategory(deps, tenantId, parsed.categoryId);
  }
  if (parsed.slug && parsed.slug !== current.slug) {
    const duplicate = await deps.repository.findProductBySlug(tenantId, parsed.slug);
    if (duplicate && duplicate.id !== productId) {
      throw conflict("CATALOG_PRODUCT_SLUG_CONFLICT", "Product slug is already in use.");
    }
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.updateProduct(tenantId, productId, parsed, context),
    "CATALOG_PRODUCT_SLUG_CONFLICT",
    "Product slug is already in use.",
  );
  return toProduct(record);
}
