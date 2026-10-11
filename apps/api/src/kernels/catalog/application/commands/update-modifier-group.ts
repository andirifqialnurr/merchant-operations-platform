import {
  createCatalogModifierGroupSchema,
  updateCatalogModifierGroupSchema,
  type UpdateCatalogModifierGroup,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireModifierGroup,
  uniqueMutation,
} from "../catalog-deps.js";
import { toModifierGroup } from "../catalog-mappers.js";

export async function updateModifierGroup(
  deps: CatalogDeps,
  tenantId: string,
  groupId: string,
  input: UpdateCatalogModifierGroup,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await requireModifierGroup(deps, tenantId, groupId);
  const parsed = updateCatalogModifierGroupSchema.parse(input);
  createCatalogModifierGroupSchema.parse({
    displayOrder: parsed.displayOrder ?? current.displayOrder,
    maxSelections: parsed.maxSelections ?? current.maxSelections,
    minSelections: parsed.minSelections ?? current.minSelections,
    name: parsed.name ?? current.name,
    selectionType: parsed.selectionType ?? current.selectionType,
  });
  if (parsed.name && parsed.name !== current.name) {
    const duplicate = await deps.repository.findModifierGroupByName(tenantId, parsed.name);
    if (duplicate && duplicate.id !== groupId) {
      throw conflict(
        "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
        "Modifier group name is already in use.",
      );
    }
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.updateModifierGroup(tenantId, groupId, parsed, context),
    "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
    "Modifier group name is already in use.",
  );
  return toModifierGroup(record);
}
