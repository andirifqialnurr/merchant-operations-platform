import {
  commandChannelSchema,
  createInventoryItemSchema,
  idempotencyKeySchema,
  inventoryItemSchema,
  requestIdSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeInventoryItem } from "../domain/item-definition.js";
import { InventoryItemWriteError } from "../domain/item-write-error.js";
import {
  INVENTORY_ITEM_WRITER,
  type InventoryItemCreateContext,
  type InventoryItemWriter,
} from "./inventory-item-writer.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";

@Injectable()
export class CreateInventoryItem {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_ITEM_WRITER) private readonly writer: InventoryItemWriter,
  ) {}

  async execute(input: unknown, context: InventoryItemCreateContext) {
    const scope = await this.access.authorize(context.identity);
    const parsed = createInventoryItemSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The item definition is invalid.",
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
      const result = inventoryItemSchema.parse(
        await this.writer.create(scope, normalizeInventoryItem(parsed.data), {
          idempotencyKey: key.data,
          origin: {
            ...context.origin,
            channel: channel.data,
            ...(request?.success ? { requestId: request.data } : {}),
          },
        }),
      );
      if (result.status !== "ACTIVE") throw new Error("Invalid created item status.");
      return result;
    } catch (error) {
      if (error instanceof InventoryItemWriteError) {
        const response = {
          code: error.code,
          message:
            "The item command conflicts with a saved definition or request. Check its outcome before retrying.",
        };
        if (
          error.code === "INVENTORY_UNIT_NOT_FOUND" ||
          error.code === "INVENTORY_CATEGORY_NOT_FOUND"
        )
          throw new NotFoundException({
            ...response,
            message: "The selected item parent is unavailable.",
          });
        throw new ConflictException(response);
      }
      throw error;
    }
  }
}
