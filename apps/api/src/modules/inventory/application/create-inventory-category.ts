import {
  commandChannelSchema,
  createInventoryCategorySchema,
  idempotencyKeySchema,
  inventoryCategorySchema,
  requestIdSchema,
} from "@merchant/contracts";
import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";

import { InventoryCategoryWriteError } from "../domain/category-write-error.js";
import {
  INVENTORY_CATEGORY_WRITER,
  type InventoryCategoryCreateContext,
  type InventoryCategoryWriter,
} from "./inventory-category-writer.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";

@Injectable()
export class CreateInventoryCategory {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_CATEGORY_WRITER) private readonly writer: InventoryCategoryWriter,
  ) {}

  async execute(input: unknown, context: InventoryCategoryCreateContext) {
    const scope = await this.access.authorize(context.identity);
    const parsed = createInventoryCategorySchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The category definition is invalid.",
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
      const result = inventoryCategorySchema.parse(
        await this.writer.create(scope, parsed.data, {
          idempotencyKey: key.data,
          origin: {
            ...context.origin,
            channel: channel.data,
            ...(request?.success ? { requestId: request.data } : {}),
          },
        }),
      );
      if (result.status !== "ACTIVE") throw new Error("Invalid created category status.");
      return result;
    } catch (error) {
      if (error instanceof InventoryCategoryWriteError)
        throw new ConflictException({
          code: error.code,
          message:
            "The category command conflicts with a saved definition or request. Check its outcome before retrying.",
        });
      throw error;
    }
  }
}
