import {
  commandChannelSchema,
  createInventoryUnitConversionSchema,
  idempotencyKeySchema,
  inventoryUnitConversionSchema,
  requestIdSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeInventoryUnitConversion } from "../domain/conversion-definition.js";
import { InventoryConversionWriteError } from "../domain/conversion-write-error.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";
import {
  INVENTORY_CONVERSION_WRITER,
  type InventoryConversionCreateContext,
  type InventoryConversionWriter,
} from "./inventory-conversion-writer.js";

@Injectable()
export class CreateInventoryUnitConversion {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_CONVERSION_WRITER) private readonly writer: InventoryConversionWriter,
  ) {}

  async execute(input: unknown, context: InventoryConversionCreateContext) {
    const scope = await this.access.authorize(context.identity);
    const parsed = createInventoryUnitConversionSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The conversion definition is invalid.",
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
        await this.writer.create(scope, normalizeInventoryUnitConversion(parsed.data), {
          idempotencyKey: key.data,
          origin: {
            ...context.origin,
            channel: channel.data,
            ...(request?.success ? { requestId: request.data } : {}),
          },
        }),
      );
    } catch (error) {
      if (error instanceof InventoryConversionWriteError) {
        if (error.code === "INVENTORY_UNIT_NOT_FOUND")
          throw new NotFoundException({
            code: error.code,
            message: "The requested unit definition is unavailable.",
          });
        throw new ConflictException({
          code: error.code,
          message:
            "The conversion command conflicts with a saved definition or request. Check its outcome before retrying.",
        });
      }
      throw error;
    }
  }
}
