import {
  catalogProductImageContentParamsSchema,
  type CatalogProductImageContentParams,
} from "@merchant/contracts";
import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Redirect,
} from "@nestjs/common";
import { ApiCookieAuth, ApiFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthService, readSessionToken } from "../core/auth/public.js";
import { accessDenied } from "../core/entitlements/public.js";
import { AccessService } from "../core/memberships/public.js";
import { readDeviceCredential } from "../shared/devices/device-identity.js";
import { ZodValidationPipe } from "../shared/validation/zod-validation.pipe.js";
import { CatalogService } from "./catalog.service.js";

/**
 * Product pictures for `<img>` tags. A picture element cannot send the
 * workspace header, so the workspace is part of the address; the session
 * cookie still decides. The answer is a short-lived signed address in the
 * object storage, so the picture itself never passes through the API.
 */
@ApiTags("Catalog")
@ApiCookieAuth()
@Controller("catalog/tenants/:tenantId/product-images")
export class CatalogImageController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @ApiOperation({ summary: "Redirect to a short-lived address of a product picture" })
  @ApiFoundResponse({ description: "Signed address of the picture" })
  // Shorter than the signed address lives, so a cached redirect never points at an expired one.
  @Header("Cache-Control", "private, max-age=240")
  @Redirect()
  @Get(":imageId/content")
  async content(
    @Param(new ZodValidationPipe(catalogProductImageContentParamsSchema))
    params: CatalogProductImageContentParams,
    @Headers("cookie") cookieHeader: string | undefined,
  ) {
    const session = await this.auth.getSession(
      readSessionToken(cookieHeader),
      readDeviceCredential(cookieHeader),
    );
    // Any active member may see the pictures of what the business sells.
    const access = await this.access.describeAccess(session.user.id, params.tenantId);
    if (!access.context || !access.membershipActive) throw accessDenied("WORKSPACE_ACCESS_DENIED");

    const url = await this.catalog.productImageUrl(params.tenantId, params.imageId);
    if (!url) {
      throw new NotFoundException({
        code: "CATALOG_PRODUCT_IMAGE_NOT_FOUND",
        message: "Product image was not found in this tenant.",
      });
    }
    return { statusCode: 302, url };
  }
}
