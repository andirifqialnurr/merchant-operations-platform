import {
  updateCatalogProductModifierGroupSchema,
  type UpdateCatalogProductModifierGroup,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import { notFound, type CatalogDeps, requireActiveTenant } from "../catalog-deps.js";
import { toProductModifierGroup } from "../catalog-mappers.js";

export async function updateProductModifierGroup(
  deps: CatalogDeps,
  tenantId: string,
  assignmentId: string,
  input: UpdateCatalogProductModifierGroup,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await deps.repository.findProductModifierGroupById(tenantId, assignmentId);
  if (!current) {
    throw notFound(
      "CATALOG_PRODUCT_MODIFIER_GROUP_NOT_FOUND",
      "Modifier assignment was not found in this tenant.",
    );
  }
  const parsed = updateCatalogProductModifierGroupSchema.parse(input);
  return toProductModifierGroup(
    await deps.repository.updateProductModifierGroup(tenantId, assignmentId, parsed, context),
  );
}
