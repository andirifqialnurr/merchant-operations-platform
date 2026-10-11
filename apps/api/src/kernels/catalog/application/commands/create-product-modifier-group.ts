import {
  createCatalogProductModifierGroupSchema,
  type CreateCatalogProductModifierGroup,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveProduct,
  requireActiveModifierGroup,
  uniqueMutation,
} from "../catalog-deps.js";
import { toProductModifierGroup } from "../catalog-mappers.js";

export async function createProductModifierGroup(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogProductModifierGroup,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogProductModifierGroupSchema.parse(input);
  await requireActiveProduct(deps, tenantId, parsed.productId);
  await requireActiveModifierGroup(deps, tenantId, parsed.modifierGroupId);
  if (
    await deps.repository.findProductModifierGroup(
      tenantId,
      parsed.productId,
      parsed.modifierGroupId,
    )
  ) {
    throw conflict(
      "CATALOG_PRODUCT_MODIFIER_GROUP_CONFLICT",
      "Modifier group is already assigned to this product.",
    );
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createProductModifierGroup(tenantId, parsed, context),
    "CATALOG_PRODUCT_MODIFIER_GROUP_CONFLICT",
    "Modifier group is already assigned to this product.",
  );
  return toProductModifierGroup(record);
}
