import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryItemSchema,
  requestIdSchema,
  updateInventoryItemSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeInventoryItemPatch } from "../domain/item-update.js";
import { InventoryItemWriteError } from "../domain/item-write-error.js";
import {
  INVENTORY_ITEM_UPDATER,
  type InventoryItemUpdateContext,
  type InventoryItemUpdater,
} from "./inventory-item-updater.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";

@Injectable()
export class UpdateInventoryItem {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_ITEM_UPDATER) private readonly updater: InventoryItemUpdater,
  ) {}
  async execute(itemId: unknown, input: unknown, context: InventoryItemUpdateContext) {
    const scope = await this.access.authorize(context.identity);
    const target = entityIdParamsSchema.safeParse({ id: itemId });
    const parsed = updateInventoryItemSchema.safeParse(input);
    if (!target.success || !parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The item update is invalid.",
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
      return inventoryItemSchema.parse(
        await this.updater.update(
          scope,
          target.data.id.toLowerCase(),
          normalizeInventoryItemPatch(parsed.data),
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
      if (error instanceof InventoryItemWriteError) {
        const response = {
          code: error.code,
          message:
            "The item update conflicts with a saved definition or request. Check its outcome before retrying.",
        };
        if (error.code.endsWith("NOT_FOUND"))
          throw new NotFoundException({
            ...response,
            message: "The requested item or parent definition is unavailable.",
          });
        throw new ConflictException(response);
      }
      throw error;
    }
  }
}
