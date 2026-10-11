import {
  updateCatalogOutletProductSchema,
  type UpdateCatalogOutletProduct,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  notFound,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveOutlet,
  requireActiveProduct,
} from "../catalog-deps.js";
import { toOutletProduct } from "../catalog-mappers.js";

export async function updateOutletProduct(
  deps: CatalogDeps,
  tenantId: string,
  outletProductId: string,
  input: UpdateCatalogOutletProduct,
  context?: CatalogMutationContext,
  expectedOutletId?: string,
) {
  await requireActiveTenant(deps, tenantId);
  const current = await deps.repository.findOutletProductById(tenantId, outletProductId);
  if (!current) {
    throw notFound(
      "CATALOG_OUTLET_PRODUCT_NOT_FOUND",
      "Outlet product was not found in this tenant.",
    );
  }
  if (expectedOutletId && current.outletId !== expectedOutletId) {
    throw notFound(
      "CATALOG_OUTLET_PRODUCT_NOT_FOUND",
      "Outlet product was not found in this outlet.",
    );
  }
  const parsed = updateCatalogOutletProductSchema.parse(input);
  if (parsed.status === "ACTIVE") {
    await requireActiveOutlet(deps, tenantId, current.outletId);
    await requireActiveProduct(deps, tenantId, current.productId);
  }
  return toOutletProduct(
    await deps.repository.updateOutletProduct(tenantId, outletProductId, parsed, context),
  );
}
