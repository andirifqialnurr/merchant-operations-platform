import { catalogOutletSnapshotSchema } from "@merchant/contracts";
import {
  notFound,
  conflict,
  type CatalogDeps,
  requireTenant,
  requireOutlet,
} from "../catalog-deps.js";
import { toProduct, toOutletProduct } from "../catalog-mappers.js";

export async function getOutletCatalog(deps: CatalogDeps, tenantId: string, outletId: string) {
  const tenant = await requireTenant(deps, tenantId);
  const outlet = await requireOutlet(deps, tenantId, outletId);
  const snapshot = await deps.repository.getSnapshot(tenantId);
  if (!snapshot) throw notFound("TENANT_NOT_FOUND", "Tenant was not found.");
  const products = new Map(snapshot.products.map((product) => [product.id, product]));
  const items = snapshot.outletProducts
    .filter((assignment) => assignment.outletId === outletId)
    .map((assignmentRecord) => {
      const productRecord = products.get(assignmentRecord.productId);
      if (!productRecord) {
        throw conflict(
          "CATALOG_OUTLET_PRODUCT_INVALID",
          "Outlet product has no valid master product.",
        );
      }
      const assignment = toOutletProduct(assignmentRecord);
      const product = toProduct(productRecord);
      const effectiveAvailability = assignment.availabilityOverride ?? product.availability;
      const effectivePriceMinor = assignment.priceOverrideMinor ?? product.basePriceMinor;
      return {
        assignment,
        effectiveAvailability,
        effectivePriceMinor,
        inheritsAvailability: assignment.availabilityOverride === null,
        inheritsPrice: assignment.priceOverrideMinor === null,
        product,
        sellable:
          tenant.status === "ACTIVE" &&
          outlet.status === "ACTIVE" &&
          assignment.status === "ACTIVE" &&
          product.status === "ACTIVE" &&
          effectiveAvailability === "AVAILABLE",
      };
    });
  return catalogOutletSnapshotSchema.parse({
    items,
    outletId,
    outletStatus: outlet.status,
    tenantId,
  });
}
