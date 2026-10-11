import { createCatalogProductSchema, type CreateCatalogProduct } from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveCategory,
  uniqueMutation,
} from "../catalog-deps.js";
import { toProduct } from "../catalog-mappers.js";

export async function createProduct(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogProduct,
  context?: CatalogMutationContext,
) {
  const tenant = await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogProductSchema.parse(input);
  // A price is never recorded in a currency other than the workspace's.
  if (parsed.currency && parsed.currency !== tenant.currency) {
    throw conflict(
      "CATALOG_CURRENCY_MISMATCH",
      "A product is priced in the currency of its workspace.",
    );
  }
  await requireActiveCategory(deps, tenantId, parsed.categoryId);
  if (await deps.repository.findProductBySlug(tenantId, parsed.slug)) {
    throw conflict("CATALOG_PRODUCT_SLUG_CONFLICT", "Product slug is already in use.");
  }
  await deps.limits.assertCanAdd(tenantId, "catalog.products.active");
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createProduct(tenantId, parsed, context),
    "CATALOG_PRODUCT_SLUG_CONFLICT",
    "Product slug is already in use.",
  );
  return toProduct(record);
}
