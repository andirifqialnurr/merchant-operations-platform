import type { UpdateInventoryUnit } from "@merchant/contracts";

type UnitDefinition = { code: string; name: string; precision: number; definitionLocked: boolean };

/** Called with a validated patch and the authoritative locked row, never client metadata. */
export function planInventoryUnitUpdate(before: UnitDefinition, patch: UpdateInventoryUnit) {
  const codeChanged = patch.code !== undefined && patch.code !== before.code;
  const precisionChanged = patch.precision !== undefined && patch.precision !== before.precision;
  const nameChanged = patch.name !== undefined && patch.name !== before.name;
  if (before.definitionLocked && (codeChanged || precisionChanged))
    return { ok: false, code: "INVENTORY_UNIT_DEFINITION_LOCKED" } as const;
  return {
    ok: true,
    changed: codeChanged || precisionChanged || nameChanged,
    nameChanged,
  } as const;
}
