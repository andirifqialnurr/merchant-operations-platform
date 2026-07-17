import { healthResponseSchema, type HealthResponse } from "@merchant/contracts";
import { Controller, Get } from "@nestjs/common";
import { ApiInternalServerErrorResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("system")
@Controller("health")
export class HealthController {
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/HealthResponse" } })
  @ApiInternalServerErrorResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Get()
  getHealth(): HealthResponse {
    return healthResponseSchema.parse({
      service: "api",
      status: "ok",
    });
  }
}
