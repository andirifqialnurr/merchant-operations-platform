import {
  commandChannelSchema,
  createInventoryUnitSchema,
  idempotencyKeySchema,
  inventoryUnitDimensionSchema,
  inventoryUnitSchema,
  requestIdSchema,
} from "@merchant/contracts";
import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";

import { InventoryUnitWriteError } from "../domain/unit-write-error.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";
import {
  INVENTORY_UNIT_WRITER,
  type InventoryUnitCreateContext,
  type InventoryUnitWriter,
} from "./inventory-unit-writer.js";

@Injectable()
export class CreateInventoryUnit {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_UNIT_WRITER) private readonly writer: InventoryUnitWriter,
  ) {}

  async execute(input: unknown, context: InventoryUnitCreateContext) {
    const scope = await this.access.authorize(context.identity);
    const parsed = createInventoryUnitSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The unit definition is invalid.",
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
      return inventoryUnitSchema.extend({ dimension: inventoryUnitDimensionSchema }).parse(
        await this.writer.create(scope, parsed.data, {
          idempotencyKey: key.data,
          origin: {
            ...context.origin,
            channel: channel.data,
            ...(request?.success ? { requestId: request.data } : {}),
          },
        }),
      );
    } catch (error) {
      if (error instanceof InventoryUnitWriteError)
        throw new ConflictException({
          code: error.code,
          message:
            "The unit command conflicts with a saved definition or request. Check its outcome before retrying.",
        });
      throw error;
    }
  }
}
