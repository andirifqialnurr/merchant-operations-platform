import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryUnitSchema,
  requestIdSchema,
  updateInventoryUnitSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { InventoryUnitWriteError } from "../domain/unit-write-error.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";
import {
  INVENTORY_UNIT_UPDATER,
  type InventoryUnitUpdateContext,
  type InventoryUnitUpdater,
} from "./inventory-unit-updater.js";

@Injectable()
export class UpdateInventoryUnit {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_UNIT_UPDATER) private readonly updater: InventoryUnitUpdater,
  ) {}

  async execute(unitId: unknown, input: unknown, context: InventoryUnitUpdateContext) {
    const scope = await this.access.authorize(context.identity);
    const target = entityIdParamsSchema.safeParse({ id: unitId });
    const parsed = updateInventoryUnitSchema.safeParse(input);
    if (!target.success || !parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The unit update is invalid.",
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
      return inventoryUnitSchema.parse(
        await this.updater.update(scope, target.data.id.toLowerCase(), parsed.data, {
          idempotencyKey: key.data,
          origin: {
            ...context.origin,
            channel: channel.data,
            ...(request?.success ? { requestId: request.data } : {}),
          },
        }),
      );
    } catch (error) {
      if (error instanceof InventoryUnitWriteError) {
        if (error.code === "INVENTORY_UNIT_NOT_FOUND")
          throw new NotFoundException({
            code: error.code,
            message: "The requested unit definition is unavailable.",
          });
        throw new ConflictException({
          code: error.code,
          message:
            "The unit update conflicts with a saved definition or request. Check its outcome before retrying.",
        });
      }
      throw error;
    }
  }
}
