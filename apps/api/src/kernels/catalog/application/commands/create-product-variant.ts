import {
  createCatalogProductVariantSchema,
  type CreateCatalogProductVariant,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  type CatalogDeps,
  requireActiveTenant,
  requireActiveProduct,
  uniqueMutation,
} from "../catalog-deps.js";
import { toProductVariant } from "../catalog-mappers.js";

export async function createProductVariant(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogProductVariant,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogProductVariantSchema.parse(input);
  await requireActiveProduct(deps, tenantId, parsed.productId);
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createProductVariant(tenantId, parsed, context),
    "CATALOG_PRODUCT_VARIANT_CONFLICT",
    "Variant name is already in use on this product.",
  );
  return toProductVariant(record);
}
