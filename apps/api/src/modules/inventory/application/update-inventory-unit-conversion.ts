import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryUnitConversionSchema,
  requestIdSchema,
  updateInventoryUnitConversionSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeInventoryConversionFactor } from "../domain/conversion-definition.js";
import { InventoryConversionWriteError } from "../domain/conversion-write-error.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";
import {
  INVENTORY_CONVERSION_UPDATER,
  type InventoryConversionUpdateContext,
  type InventoryConversionUpdater,
} from "./inventory-conversion-updater.js";

@Injectable()
export class UpdateInventoryUnitConversion {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_CONVERSION_UPDATER) private readonly updater: InventoryConversionUpdater,
  ) {}

  async execute(conversionId: unknown, input: unknown, context: InventoryConversionUpdateContext) {
    const scope = await this.access.authorize(context.identity);
    const target = entityIdParamsSchema.safeParse({ id: conversionId });
    const parsed = updateInventoryUnitConversionSchema.safeParse(input);
    if (!target.success || !parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The conversion update is invalid.",
      });
    const key = idempotencyKeySchema.safeParse(context.idempotencyKey);
    if (!key.success)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "A valid idempotency key is required.",
      });
    const channel = commandChannelSchema.safeParse(context.origin.channel ?? "API");
    const request =
      context.origin.requestId === undefined
        ? undefined
        : requestIdSchema.safeParse(context.origin.requestId);
    if (
      context.origin.actorId.toLowerCase() !== scope.actorId.toLowerCase() ||
      context.origin.deviceId ||
      !channel.success ||
      (request && !request.success)
    )
      throw new BadRequestException({
        code: "INVENTORY_COMMAND_CONTEXT_INVALID",
        message: "The command origin does not match its authorized context.",
      });
    try {
      return inventoryUnitConversionSchema.parse(
        await this.updater.update(
          scope,
          target.data.id.toLowerCase(),
          { factor: normalizeInventoryConversionFactor(parsed.data.factor) },
          {
            idempotencyKey: key.data,
            origin: {
              ...context.origin,
              channel: channel.data,
              ...(request?.success ? { requestId: request.data } : {}),
            },
          },
        ),
      );
    } catch (error) {
      if (error instanceof InventoryConversionWriteError) {
        if (error.code === "INVENTORY_CONVERSION_NOT_FOUND")
          throw new NotFoundException({
            code: error.code,
            message: "The requested conversion definition is unavailable.",
          });
        throw new ConflictException({
          code: error.code,
          message:
            "The conversion update conflicts with a saved definition or request. Check its outcome before retrying.",
        });
      }
      throw error;
    }
  }
}
