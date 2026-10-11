import {
  createCatalogProductImageSchema,
  productImageContentTypeSchema,
  type CreateCatalogProductImage,
} from "@merchant/contracts";
import { type CatalogMutationContext } from "../catalog.repository.js";
import {
  conflict,
  type CatalogDeps,
  requireActiveTenant,
  requireActiveProduct,
  uniqueMutation,
} from "../catalog-deps.js";
import { toProductImage } from "../catalog-mappers.js";

export async function createProductImage(
  deps: CatalogDeps,
  tenantId: string,
  input: CreateCatalogProductImage,
  context?: CatalogMutationContext,
) {
  await requireActiveTenant(deps, tenantId);
  const parsed = createCatalogProductImageSchema.parse(input);
  await requireActiveProduct(deps, tenantId, parsed.productId);
  if (await deps.repository.findProductImageByObjectKey(tenantId, parsed.objectKey)) {
    throw conflict("CATALOG_PRODUCT_IMAGE_KEY_CONFLICT", "Image object key is already in use.");
  }
  // The file must be in this workspace's folder and really be an image; the
  // type that is stored is the one found in the file, not the one claimed.
  const stored = await deps.files?.verifyUpload(
    tenantId,
    "CATALOG_PRODUCT_IMAGE",
    parsed.objectKey,
  );
  const checked = stored
    ? { ...parsed, contentType: productImageContentTypeSchema.parse(stored.contentType) }
    : parsed;
  const record = await uniqueMutation(
    deps,
    () => deps.repository.createProductImage(tenantId, checked, context),
    "CATALOG_PRODUCT_IMAGE_KEY_CONFLICT",
    "Image object key is already in use.",
  );
  return toProductImage(record);
}
