import {
  API_HEADERS,
  catalogCategorySchema,
  catalogModifierGroupSchema,
  catalogModifierOptionSchema,
  catalogOutletParamsSchema,
  catalogOutletProductParamsSchema,
  catalogOutletProductSchema,
  catalogOutletSnapshotSchema,
  catalogProductImageSchema,
  catalogProductModifierGroupSchema,
  catalogProductSchema,
  catalogProductVariantSchema,
  catalogSnapshotSchema,
  createCatalogCategorySchema,
  createCatalogModifierGroupSchema,
  createCatalogModifierOptionSchema,
  createCatalogOutletProductForOutletSchema,
  createCatalogProductImageSchema,
  createCatalogProductModifierGroupSchema,
  createCatalogProductSchema,
  createCatalogProductVariantSchema,
  entityIdParamsSchema,
  MODULES,
  PERMISSIONS,
  requestContextHeadersSchema,
  tenantRequestHeadersSchema,
  updateCatalogCategorySchema,
  updateCatalogModifierGroupSchema,
  updateCatalogModifierOptionSchema,
  updateCatalogOutletProductSchema,
  updateCatalogProductImageSchema,
  updateCatalogProductModifierGroupSchema,
  updateCatalogProductSchema,
  updateCatalogProductVariantSchema,
  type AuthorizationContext,
  type CatalogOutletParams,
  type CatalogOutletProductParams,
  type CreateCatalogCategory,
  type CreateCatalogModifierGroup,
  type CreateCatalogModifierOption,
  type CreateCatalogOutletProductForOutlet,
  type CreateCatalogProduct,
  type CreateCatalogProductImage,
  type CreateCatalogProductModifierGroup,
  type CreateCatalogProductVariant,
  type RequestContextHeaders,
  type TenantRequestHeaders,
  type UpdateCatalogCategory,
  type UpdateCatalogModifierGroup,
  type UpdateCatalogModifierOption,
  type UpdateCatalogOutletProduct,
  type UpdateCatalogProduct,
  type UpdateCatalogProductImage,
  type UpdateCatalogProductModifierGroup,
  type UpdateCatalogProductVariant,
} from "@merchant/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import {
  CurrentAccess,
  RequireAllOutlets,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../access/session-permission.guard.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { RequestHeaders, ZodValidationPipe } from "../zod-validation.pipe.js";
import { CatalogService } from "./catalog.service.js";

type MutationHeaders = RequestContextHeaders | TenantRequestHeaders;

@ApiTags("catalog")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiHeader({
  name: API_HEADERS.tenantId,
  required: true,
  schema: { format: "uuid", type: "string" },
})
@ApiHeader({
  name: API_HEADERS.outletId,
  required: false,
  schema: { format: "uuid", type: "string" },
})
@ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.coreCatalog)
@Controller("catalog")
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}

  private mutationContext(access: AuthorizationContext, headers: MutationHeaders) {
    const requestId = headers[API_HEADERS.requestId];
    return { actorId: access.userId, ...(requestId ? { requestId } : {}) };
  }

  private assertOutletScope(headers: RequestContextHeaders, outletId: string) {
    if (headers[API_HEADERS.outletId] !== outletId) {
      throw new BadRequestException({
        code: "OUTLET_SCOPE_MISMATCH",
        message: "Outlet route harus sama dengan x-outlet-id.",
      });
    }
  }

  @ApiOperation({ summary: "Read the complete tenant Catalog backoffice snapshot" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogSnapshot" } })
  @RequirePermission(PERMISSIONS.catalogRead)
  @RequireAllOutlets()
  @Get()
  async snapshot(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return catalogSnapshotSchema.parse(
      await this.service.getSnapshot(headers[API_HEADERS.tenantId]),
    );
  }

  @ApiOperation({ summary: "Create a tenant Catalog category" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogCategory" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogCategory" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("categories")
  async createCategory(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogCategorySchema)) input: CreateCatalogCategory,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogCategorySchema.parse(
      await this.service.createCategory(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a tenant Catalog category" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogCategory" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogCategory" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("categories/:id")
  async updateCategory(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogCategorySchema)) input: UpdateCatalogCategory,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogCategorySchema.parse(
      await this.service.updateCategory(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Create a tenant Catalog product" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogProduct" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogProduct" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("products")
  async createProduct(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogProductSchema)) input: CreateCatalogProduct,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductSchema.parse(
      await this.service.createProduct(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a tenant Catalog product" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogProduct" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogProduct" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("products/:id")
  async updateProduct(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogProductSchema)) input: UpdateCatalogProduct,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductSchema.parse(
      await this.service.updateProduct(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Create a product variant" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogProductVariant" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogProductVariant" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("variants")
  async createVariant(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogProductVariantSchema))
    input: CreateCatalogProductVariant,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductVariantSchema.parse(
      await this.service.createProductVariant(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a product variant" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogProductVariant" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogProductVariant" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("variants/:id")
  async updateVariant(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogProductVariantSchema))
    input: UpdateCatalogProductVariant,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductVariantSchema.parse(
      await this.service.updateProductVariant(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Create a Catalog modifier group" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogModifierGroup" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogModifierGroup" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("modifier-groups")
  async createModifierGroup(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogModifierGroupSchema))
    input: CreateCatalogModifierGroup,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogModifierGroupSchema.parse(
      await this.service.createModifierGroup(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a Catalog modifier group" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogModifierGroup" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogModifierGroup" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("modifier-groups/:id")
  async updateModifierGroup(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogModifierGroupSchema))
    input: UpdateCatalogModifierGroup,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogModifierGroupSchema.parse(
      await this.service.updateModifierGroup(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Create a Catalog modifier option" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogModifierOption" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogModifierOption" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("modifier-options")
  async createModifierOption(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogModifierOptionSchema))
    input: CreateCatalogModifierOption,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogModifierOptionSchema.parse(
      await this.service.createModifierOption(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a Catalog modifier option" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogModifierOption" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogModifierOption" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("modifier-options/:id")
  async updateModifierOption(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogModifierOptionSchema))
    input: UpdateCatalogModifierOption,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogModifierOptionSchema.parse(
      await this.service.updateModifierOption(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Assign a modifier group to a product" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogProductModifierGroup" } })
  @ApiCreatedResponse({
    schema: { $ref: "#/components/schemas/CatalogProductModifierGroup" },
  })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("product-modifier-groups")
  async createProductModifierGroup(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogProductModifierGroupSchema))
    input: CreateCatalogProductModifierGroup,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductModifierGroupSchema.parse(
      await this.service.createProductModifierGroup(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a product modifier-group assignment" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogProductModifierGroup" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogProductModifierGroup" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("product-modifier-groups/:id")
  async updateProductModifierGroup(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogProductModifierGroupSchema))
    input: UpdateCatalogProductModifierGroup,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductModifierGroupSchema.parse(
      await this.service.updateProductModifierGroup(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Register product image object metadata" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogProductImage" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogProductImage" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Post("product-images")
  async createProductImage(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCatalogProductImageSchema))
    input: CreateCatalogProductImage,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductImageSchema.parse(
      await this.service.createProductImage(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update product image metadata or lifecycle" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogProductImage" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogProductImage" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @RequireAllOutlets()
  @Patch("product-images/:id")
  async updateProductImage(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCatalogProductImageSchema))
    input: UpdateCatalogProductImage,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return catalogProductImageSchema.parse(
      await this.service.updateProductImage(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Read the effective Catalog for one authorized outlet" })
  @ApiHeader({
    name: API_HEADERS.outletId,
    required: true,
    schema: { format: "uuid", type: "string" },
  })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogOutletSnapshot" } })
  @RequirePermission(PERMISSIONS.catalogRead)
  @Get("outlets/:outletId")
  async outletSnapshot(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(catalogOutletParamsSchema)) params: CatalogOutletParams,
  ) {
    this.assertOutletScope(headers, params.outletId);
    return catalogOutletSnapshotSchema.parse(
      await this.service.getOutletCatalog(headers[API_HEADERS.tenantId], params.outletId),
    );
  }

  @ApiOperation({ summary: "Assign a product to one authorized outlet" })
  @ApiHeader({
    name: API_HEADERS.outletId,
    required: true,
    schema: { format: "uuid", type: "string" },
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCatalogOutletProductForOutlet" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/CatalogOutletProduct" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @Post("outlets/:outletId/products")
  async createOutletProduct(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(catalogOutletParamsSchema)) params: CatalogOutletParams,
    @Body(new ZodValidationPipe(createCatalogOutletProductForOutletSchema))
    input: CreateCatalogOutletProductForOutlet,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    this.assertOutletScope(headers, params.outletId);
    return catalogOutletProductSchema.parse(
      await this.service.createOutletProduct(
        headers[API_HEADERS.tenantId],
        { ...input, outletId: params.outletId },
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update one product assignment inside the authorized outlet" })
  @ApiHeader({
    name: API_HEADERS.outletId,
    required: true,
    schema: { format: "uuid", type: "string" },
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCatalogOutletProduct" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CatalogOutletProduct" } })
  @RequirePermission(PERMISSIONS.catalogManage)
  @Patch("outlets/:outletId/products/:id")
  async updateOutletProduct(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(catalogOutletProductParamsSchema))
    params: CatalogOutletProductParams,
    @Body(new ZodValidationPipe(updateCatalogOutletProductSchema))
    input: UpdateCatalogOutletProduct,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    this.assertOutletScope(headers, params.outletId);
    return catalogOutletProductSchema.parse(
      await this.service.updateOutletProduct(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
        params.outletId,
      ),
    );
  }
}
