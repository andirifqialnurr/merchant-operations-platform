import {
  createCatalogOutletProductSchema,
  type CreateCatalogOutletProduct,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveOutlet,
  requireActiveProduct,
  uniqueMutation,
} from "../catalog-deps.js";
import { toOutletProduct } from "../catalog-mappers.js";

export async function createOutletProduct(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogOutletProduct,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogOutletProductSchema.parse(input);
  await requireActiveOutlet(deps, tenantId, parsed.outletId);
  await requireActiveProduct(deps, tenantId, parsed.productId);
  if (await deps.repository.findOutletProduct(tenantId, parsed.outletId, parsed.productId)) {
    throw conflict(
      "CATALOG_OUTLET_PRODUCT_CONFLICT",
      "Product is already assigned to this outlet.",
    );
  }
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createOutletProduct(tenantId, parsed, context),
    "CATALOG_OUTLET_PRODUCT_CONFLICT",
    "Product is already assigned to this outlet.",
  );
  return toOutletProduct(record);
}
