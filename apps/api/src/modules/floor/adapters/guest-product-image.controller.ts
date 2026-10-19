import { guestProductImageParamsSchema } from "@merchant/contracts";
import { Controller, Get, Header, Inject, Ip, Param, StreamableFile } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ZodValidationPipe } from "../../../shared/validation/zod-validation.pipe.js";
import { GuestProductImage } from "../application/guest-product-image.js";

@ApiTags("table-self-order")
@Controller("public/table-qr")
export class GuestProductImageController {
  constructor(@Inject(GuestProductImage) private readonly images: GuestProductImage) {}

  @ApiOperation({ summary: "A current menu picture, proxied without a workspace/storage URL" })
  @ApiProduces("image/jpeg", "image/png", "image/webp", "image/avif")
  @ApiOkResponse({ schema: { type: "string", format: "binary" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiServiceUnavailableResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiTooManyRequestsResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Referrer-Policy", "no-referrer")
  @Header("Content-Disposition", "inline")
  @Get(":token/products/:productId/image")
  async content(
    @Param(new ZodValidationPipe(guestProductImageParamsSchema))
    params: { token: string; productId: string },
    @Ip() address: string | undefined,
  ) {
    const { bytes, contentType } = await this.images.execute(
      params.token,
      params.productId,
      address,
    );
    return new StreamableFile(bytes, { type: contentType, length: bytes.byteLength });
  }
}
