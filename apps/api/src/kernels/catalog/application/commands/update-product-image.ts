import {
  updateCatalogProductImageSchema,
  type UpdateCatalogProductImage,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import { notFound, type CatalogDeps, requireActiveTenant } from "../catalog-deps.js";
import { toProductImage } from "../catalog-mappers.js";

export async function updateProductImage(
  deps: CatalogDeps,
  tenantId: string,
  imageId: string,
  input: UpdateCatalogProductImage,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  if (!(await deps.repository.findProductImageById(tenantId, imageId))) {
    throw notFound(
      "CATALOG_PRODUCT_IMAGE_NOT_FOUND",
      "Product image was not found in this tenant.",
    );
  }
  const parsed = updateCatalogProductImageSchema.parse(input);
  return toProductImage(
    await deps.repository.updateProductImage(tenantId, imageId, parsed, context),
  );
}
