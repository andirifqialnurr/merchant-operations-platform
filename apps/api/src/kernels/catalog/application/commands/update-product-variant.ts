import {
  updateCatalogProductVariantSchema,
  type UpdateCatalogProductVariant,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  notFound,
  type CatalogDeps,
  requireActiveTenant,
  uniqueMutation,
} from "../catalog-deps.js";
import { toProductVariant } from "../catalog-mappers.js";

export async function updateProductVariant(
  deps: CatalogDeps,
  tenantId: string,
  variantId: string,
  input: UpdateCatalogProductVariant,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await deps.repository.findProductVariantById(tenantId, variantId);
  if (!current) {
    throw notFound("CATALOG_PRODUCT_VARIANT_NOT_FOUND", "Variant was not found in this tenant.");
  }
  const parsed = updateCatalogProductVariantSchema.parse(input);
  const record = await uniqueMutation(
    deps,
    () => deps.repository.updateProductVariant(tenantId, variantId, parsed, context),
    "CATALOG_PRODUCT_VARIANT_CONFLICT",
    "Variant name is already in use on this product.",
  );
  return toProductVariant(record);
}
