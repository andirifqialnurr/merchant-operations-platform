import {
  API_HEADERS,
  fileUploadRequestSchema,
  fileUploadTicketSchema,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type FileUploadRequest,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import { Body, Controller, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { RequestHeaders, ZodValidationPipe } from "../../shared/validation/zod-validation.pipe.js";
import { accessDenied } from "../entitlements/public.js";
import { CurrentAccess, SessionPermissionGuard } from "../memberships/public.js";
import { FileStorageService } from "./file-storage.service.js";

@ApiTags("Files")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@Controller("files")
export class FileController {
  constructor(@Inject(FileStorageService) private readonly service: FileStorageService) {}

  @ApiOperation({ summary: "Get a signed URL for uploading one file straight to storage" })
  @ApiBody({ schema: { $ref: "#/components/schemas/FileUploadRequest" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FileUploadTicket" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post("uploads")
  async createUpload(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(fileUploadRequestSchema)) input: FileUploadRequest,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    // The permission depends on what the file is for, so it is checked here
    // rather than by a fixed decorator.
    if (!access.permissionKeys.includes(this.service.permissionFor(input.purpose))) {
      throw accessDenied("PERMISSION_DENIED");
    }
    return fileUploadTicketSchema.parse(
      this.service.createUpload(headers[API_HEADERS.tenantId], input),
    );
  }
}
