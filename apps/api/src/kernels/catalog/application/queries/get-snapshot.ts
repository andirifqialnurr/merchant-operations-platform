import { catalogSnapshotSchema } from "@merchant/contracts";
import { notFound, type CatalogDeps } from "../catalog-deps.js";
import {
  toCategory,
  toProduct,
  toProductVariant,
  toModifierGroup,
  toModifierOption,
  toProductModifierGroup,
  toProductImage,
  toOutletProduct,
} from "../catalog-mappers.js";

export async function getSnapshot(deps: CatalogDeps, tenantId: string) {
  const snapshot = await deps.repository.getSnapshot(tenantId);
  if (!snapshot) throw notFound("TENANT_NOT_FOUND", "Tenant was not found.");
  return catalogSnapshotSchema.parse({
    categories: snapshot.categories.map(toCategory),
    modifierGroups: snapshot.modifierGroups.map(toModifierGroup),
    modifierOptions: snapshot.modifierOptions.map(toModifierOption),
    outletProducts: snapshot.outletProducts.map(toOutletProduct),
    productImages: snapshot.productImages.map(toProductImage),
    productModifierGroups: snapshot.productModifierGroups.map(toProductModifierGroup),
    productVariants: snapshot.productVariants.map(toProductVariant),
    products: snapshot.products.map(toProduct),
  });
}
