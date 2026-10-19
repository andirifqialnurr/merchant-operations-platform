import { HttpException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import {
  InMemoryRateLimitService,
  RATE_LIMIT_SERVICE,
  type RateLimitService,
} from "../../../core/security/public.js";
import { CatalogService } from "../../../kernels/catalog/public.js";
import { hashQrToken } from "../domain/qr-token.js";
import { TableQrCodes } from "./table-qr-codes.js";

export const GUEST_IMAGE_RATE_LIMITS = {
  table: { limit: 120, windowMs: 60_000 },
  address: { limit: 300, windowMs: 60_000 },
} as const;
const missing = () =>
  new NotFoundException({
    code: "CATALOG_PRODUCT_IMAGE_NOT_FOUND",
    message: "Product image was not found.",
  });

/** QR permission and the current sellable menu gate every private-storage byte read. */
@Injectable()
export class GuestProductImage {
  constructor(
    @Inject(TableQrCodes) private readonly codes: TableQrCodes,
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Optional()
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimit: RateLimitService = new InMemoryRateLimitService(),
  ) {}

  async execute(token: string, productId: string, address: string | undefined) {
    await this.rateLimit.consume(
      `guest-image:address:${address ?? "unknown"}`,
      GUEST_IMAGE_RATE_LIMITS.address,
    );
    await this.rateLimit.consume(
      `guest-image:table:${hashQrToken(token)}`,
      GUEST_IMAGE_RATE_LIMITS.table,
    );
    const { target, resolution } = await this.codes.target(token);
    if (!target || resolution.status !== "READY") throw missing();
    try {
      const menu = await this.catalog.getSellableMenu(target.tenantId, target.outletId);
      const product = menu.products.find((item) => item.id === productId);
      if (!product?.imageId) throw missing();
      const content = await this.catalog.primaryProductImageContent(
        target.tenantId,
        product.imageId,
      );
      if (!content) throw missing();
      return content;
    } catch (error) {
      // No distinct business/storage state for a missing/invalid public picture.
      if (error instanceof HttpException && error.getStatus() < 500) throw missing();
      throw error;
    }
  }
}
