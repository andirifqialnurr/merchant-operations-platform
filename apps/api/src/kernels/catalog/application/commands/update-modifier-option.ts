import {
  updateCatalogModifierOptionSchema,
  type UpdateCatalogModifierOption,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  notFound,
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  uniqueMutation,
} from "../catalog-deps.js";
import { toModifierOption } from "../catalog-mappers.js";

export async function updateModifierOption(
  deps: CatalogDeps,
  tenantId: string,
  optionId: string,
  input: UpdateCatalogModifierOption,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await deps.repository.findModifierOptionById(tenantId, optionId);
  if (!current) {
    throw notFound(
      "CATALOG_MODIFIER_OPTION_NOT_FOUND",
      "Modifier option was not found in this tenant.",
    );
  }
  const parsed = updateCatalogModifierOptionSchema.parse(input);
  if (parsed.name && parsed.name !== current.name) {
    const duplicate = await deps.repository.findModifierOptionByName(
      tenantId,
      current.groupId,
      parsed.name,
    );
    if (duplicate && duplicate.id !== optionId) {
      throw conflict(
        "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
        "Modifier option name is already in use in this group.",
      );
    }
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.updateModifierOption(tenantId, optionId, parsed, context),
    "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
    "Modifier option name is already in use in this group.",
  );
  return toModifierOption(record);
}
