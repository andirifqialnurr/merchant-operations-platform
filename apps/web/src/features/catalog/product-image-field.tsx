"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { CatalogProduct, CatalogSnapshot } from "@merchant/contracts";
import { FileUpload } from "@merchant/ui/file-upload";

import { merchantApi, productImageUrl } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { makeThumbnail } from "@/lib/image-thumbnail";
import { uploadWithTicket } from "@/lib/upload";

import type { CatalogMutation } from "./api";

/** What the file dialog offers. The stored picture is made from it in the browser. */
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
/** A photo larger than this is almost certainly not meant as a product picture. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * The product's picture: the current one, and a way to replace or remove it.
 * A chosen photo is scaled down here, uploaded straight to storage, and only
 * then attached to the product, after the API checked the stored file.
 */
export function ProductImageField({
  canManage,
  mutation,
  product,
  snapshot,
  tenantId,
}: Readonly<{
  canManage: boolean;
  mutation: CatalogMutation;
  product: CatalogProduct;
  snapshot: CatalogSnapshot;
  tenantId: string;
}>) {
  const t = useTranslations("catalog");
  const errorMessage = useErrorMessage();
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();
  const [localPreview, setLocalPreview] = useState<string>();

  const current = snapshot.productImages.find(
    (image) => image.productId === product.id && image.status === "ACTIVE" && image.isPrimary,
  );

  // The local preview is a browser object; release it when it is replaced or the sheet closes.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function select(file: File) {
    setError(undefined);
    if (!ACCEPT.split(",").includes(file.type)) {
      setError(t("imageTypeNotAllowed"));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError(t("imageTooLarge"));
      return;
    }
    let thumbnail;
    try {
      thumbnail = await makeThumbnail(file);
    } catch {
      setError(t("imageUnreadable"));
      return;
    }

    setLocalPreview(URL.createObjectURL(thumbnail.blob));
    setProgress(0);
    try {
      const ticket = await merchantApi.createUpload(tenantId, {
        contentType: thumbnail.contentType,
        purpose: "CATALOG_PRODUCT_IMAGE",
        sizeBytes: thumbnail.blob.size,
      });
      await uploadWithTicket(ticket, thumbnail.blob, setProgress);
      await mutation.mutateAsync({
        action: () =>
          merchantApi.createProductImage(tenantId, {
            // Derived, not asked: the picture shows the product.
            altText: product.name,
            contentType: thumbnail.contentType as "image/jpeg" | "image/webp",
            displayOrder: 0,
            height: thumbnail.height,
            isPrimary: true,
            objectKey: ticket.objectKey,
            productId: product.id,
            width: thumbnail.width,
          }),
        success: t("imageSaved"),
      });
    } catch (failure) {
      // The mutation already showed its own failure; storage and ticket errors are shown here.
      setError(
        failure instanceof Error && failure.name === "UploadError"
          ? t("imageUploadFailed")
          : errorMessage(failure),
      );
    } finally {
      setProgress(undefined);
      setLocalPreview(undefined);
    }
  }

  const previewUrl = localPreview ?? (current ? productImageUrl(tenantId, current.id) : undefined);

  return (
    <FileUpload
      accept={ACCEPT}
      chooseLabel={t("imageChoose")}
      disabled={!canManage || mutation.isPending}
      {...(error ? { error } : {})}
      hint={t("imageHint")}
      label={t("image")}
      {...(current && canManage
        ? {
            onRemove: () =>
              mutation.mutate({
                action: () =>
                  merchantApi.updateProductImage(tenantId, current.id, { status: "INACTIVE" }),
                success: t("imageRemoved"),
              }),
            removeLabel: t("imageRemove"),
          }
        : {})}
      onSelect={(file) => void select(file)}
      previewAlt={product.name}
      {...(previewUrl ? { previewUrl } : {})}
      {...(progress === undefined
        ? {}
        : { progress, progressLabel: t("imageUploading", { percent: progress }) })}
      replaceLabel={t("imageReplace")}
    />
  );
}
