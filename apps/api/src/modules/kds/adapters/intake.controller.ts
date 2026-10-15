import {
  API_HEADERS,
  intakeKitchenTicketSchema,
  requestIdSchema,
  type IntakeKitchenTicket as IntakeRequest,
} from "@merchant/contracts";
import { Body, Controller, Headers, Inject, Post, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ZodValidationPipe } from "../../../shared/validation/zod-validation.pipe.js";
import { IntakeKitchenTicket } from "../application/intake-kitchen-ticket.js";

type StatusResponse = { status(code: number): unknown };

/**
 * Where an external system sends a kitchen ticket, with its own key instead
 * of a person's session. The key decides the workspace and the outlet, so
 * the request names neither.
 */
@ApiTags("kds")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiTooManyRequestsResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@Controller("kds/intake")
export class IntakeController {
  constructor(@Inject(IntakeKitchenTicket) private readonly intake: IntakeKitchenTicket) {}

  @ApiOperation({
    summary: "Send a ticket to the kitchen; the same reference again returns the same ticket",
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/IntakeKitchenTicket" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/IntakeKitchenTicketResult" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/IntakeKitchenTicketResult" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
  @Post("tickets")
  async send(
    @Headers("authorization") authorization: string | undefined,
    @Headers(API_HEADERS.requestId) requestId: string | undefined,
    @Body(new ZodValidationPipe(intakeKitchenTicketSchema)) input: IntakeRequest,
    @Res({ passthrough: true }) response: StatusResponse,
  ) {
    const source = await this.intake.authenticate(authorization);
    const parsedRequestId = requestIdSchema.safeParse(requestId);
    const result = await this.intake.execute(source, input, {
      ...(parsedRequestId.success ? { requestId: parsedRequestId.data } : {}),
    });
    // A repeated reference made nothing new.
    response.status(result.created ? 201 : 200);
    return result;
  }
}
