import {
  API_HEADERS,
  createCustomerSchema,
  customerDetailSchema,
  customerListSchema,
  customerSchema,
  customerSearchQuerySchema,
  entityIdParamsSchema,
  linkCustomerOrderSchema,
  MODULES,
  orderCustomerSchema,
  PERMISSIONS,
  requestContextHeadersSchema,
  tenantRequestHeadersSchema,
  updateCustomerSchema,
  type AuthorizationContext,
  type CreateCustomer,
  type LinkCustomerOrder,
  type RequestContextHeaders,
  type TenantRequestHeaders,
  type UpdateCustomer,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
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

import { SESSION_COOKIE_NAME } from "../../../core/auth/public.js";
import {
  CurrentAccess,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../core/memberships/public.js";
import { commandOriginFromRequest } from "../../../shared/command/command-origin.js";
import {
  RequestHeaders,
  ZodValidationPipe,
} from "../../../shared/validation/zod-validation.pipe.js";
import { Customers } from "../application/customers.js";

const seesContact = (access: AuthorizationContext) =>
  access.permissionKeys.includes(PERMISSIONS.customerContactView);

/** Customer Basic for staff: finding, adding, and linking customers to orders. */
@ApiTags("customers")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.customerBasic)
@Controller("customers")
export class CustomerController {
  constructor(@Inject(Customers) private readonly customers: Customers) {}

  @ApiOperation({ summary: "Find customers by name, or by phone with four or more digits" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CustomerList" } })
  @RequirePermission(PERMISSIONS.customerView)
  @Get()
  async search(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Query(new ZodValidationPipe(customerSearchQuerySchema)) query: { q?: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return customerListSchema.parse({
      customers: await this.customers.search(
        headers[API_HEADERS.tenantId],
        query.q,
        seesContact(access),
      ),
    });
  }

  @ApiOperation({ summary: "Add a customer with a name or a phone number" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateCustomer" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Customer" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.customerManage)
  @Post()
  async create(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createCustomerSchema)) input: CreateCustomer,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    // Without contact rights a cashier may still type a number to find or add someone.
    return customerSchema.parse(
      await this.customers.create(
        headers[API_HEADERS.tenantId],
        input,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
        seesContact(access),
      ),
    );
  }

  @ApiOperation({ summary: "The customer linked to an order, if any" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/OrderCustomer" } })
  @RequirePermission(PERMISSIONS.customerView)
  @Get("orders/:id")
  async ofOrder(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return orderCustomerSchema.parse({
      customer: await this.customers.customerOfOrder(
        headers[API_HEADERS.tenantId],
        params.id,
        seesContact(access),
      ),
    });
  }

  @ApiOperation({ summary: "A customer with the orders linked to them" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CustomerDetail" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.customerView)
  @Get(":id")
  async detail(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return customerDetailSchema.parse(
      await this.customers.detail(headers[API_HEADERS.tenantId], params.id, seesContact(access)),
    );
  }

  @ApiOperation({ summary: "Change a customer's name, phone, or note; null clears one" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateCustomer" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Customer" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.customerManage)
  @Patch(":id")
  async update(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateCustomerSchema)) input: UpdateCustomer,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return customerSchema.parse(
      await this.customers.update(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
        seesContact(access),
      ),
    );
  }

  @ApiOperation({ summary: "Link an order of the outlet to the customer" })
  @ApiHeader({ name: API_HEADERS.outletId, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/LinkCustomerOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CustomerDetail" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.customerView)
  @HttpCode(200)
  @Post(":id/orders")
  async link(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(linkCustomerOrderSchema)) input: LinkCustomerOrder,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return customerDetailSchema.parse(
      await this.customers.linkOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input.orderId,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
        seesContact(access),
      ),
    );
  }
}
