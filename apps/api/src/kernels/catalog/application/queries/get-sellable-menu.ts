import { sellableMenuSchema } from "@merchant/contracts";
import { buildSellableMenu } from "../../domain/sellable-menu.js";
import { notFound, type CatalogDeps, requireTenant, requireOutlet } from "../catalog-deps.js";

/** The outlet's sellable menu; empty while the tenant or outlet is inactive. */
export async function getSellableMenu(deps: CatalogDeps, tenantId: string, outletId: string) {
  const tenant = await requireTenant(deps, tenantId);
  const outlet = await requireOutlet(deps, tenantId, outletId);
  const snapshot = await deps.repository.getSnapshot(tenantId);
  if (!snapshot) throw notFound("TENANT_NOT_FOUND", "Tenant was not found.");
  const open = tenant.status === "ACTIVE" && outlet.status === "ACTIVE";
  return sellableMenuSchema.parse(
    open ? buildSellableMenu(snapshot, outletId) : { categories: [], outletId, products: [] },
  );
}
