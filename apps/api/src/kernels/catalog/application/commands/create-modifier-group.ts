import {
  createCatalogModifierGroupSchema,
  type CreateCatalogModifierGroup,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  uniqueMutation,
} from "../catalog-deps.js";
import { toModifierGroup } from "../catalog-mappers.js";

export async function createModifierGroup(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogModifierGroup,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogModifierGroupSchema.parse(input);
  if (await deps.repository.findModifierGroupByName(tenantId, parsed.name)) {
    throw conflict(
      "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
      "Modifier group name is already in use.",
    );
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createModifierGroup(tenantId, parsed, context),
    "CATALOG_MODIFIER_GROUP_NAME_CONFLICT",
    "Modifier group name is already in use.",
  );
  return toModifierGroup(record);
}
