import { type CatalogDeps } from "../catalog-deps.js";

/** A short-lived address for showing an active picture; null when there is none. */
export async function productImageUrl(deps: CatalogDeps, tenantId: string, imageId: string) {
  const image = await deps.repository.findProductImageById(tenantId, imageId);
  if (!image || image.status !== "ACTIVE" || !deps.files) return null;
  return deps.files.readUrl(tenantId, "CATALOG_PRODUCT_IMAGE", image.objectKey);
}
