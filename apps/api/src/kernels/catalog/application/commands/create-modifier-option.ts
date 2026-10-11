import {
  createCatalogModifierOptionSchema,
  type CreateCatalogModifierOption,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveModifierGroup,
  uniqueMutation,
} from "../catalog-deps.js";
import { toModifierOption } from "../catalog-mappers.js";

export async function createModifierOption(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogModifierOption,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogModifierOptionSchema.parse(input);
  await requireActiveModifierGroup(deps, tenantId, parsed.groupId);
  if (await deps.repository.findModifierOptionByName(tenantId, parsed.groupId, parsed.name)) {
    throw conflict(
      "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
      "Modifier option name is already in use in this group.",
    );
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createModifierOption(tenantId, parsed, context),
    "CATALOG_MODIFIER_OPTION_NAME_CONFLICT",
    "Modifier option name is already in use in this group.",
  );
  return toModifierOption(record);
}
