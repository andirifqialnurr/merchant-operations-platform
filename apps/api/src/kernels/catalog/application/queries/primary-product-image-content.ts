import type { CatalogDeps } from "../catalog-deps.js";

/** The caller owns public-menu eligibility; Catalog alone resolves its private image metadata. */
export async function primaryProductImageContent(
  deps: CatalogDeps,
  tenantId: string,
  imageId: string,
) {
  const image = await deps.repository.findProductImageById(tenantId, imageId);
  if (!image || image.status !== "ACTIVE" || !image.isPrimary || !deps.files) return null;
  return deps.files.readImage(tenantId, "CATALOG_PRODUCT_IMAGE", image.objectKey);
}
