import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryCategorySchema,
  requestIdSchema,
  setInventoryCategoryStatusSchema,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { InventoryCategoryWriteError } from "../domain/category-write-error.js";
import {
  INVENTORY_CATEGORY_STATUS_WRITER,
  type InventoryCategoryStatusContext,
  type InventoryCategoryStatusWriter,
} from "./inventory-category-status-writer.js";
import {
  INVENTORY_MASTER_WRITE_ACCESS,
  type InventoryMasterWriteAccess,
} from "./inventory-master-write-access.js";

@Injectable()
export class SetInventoryCategoryStatus {
  constructor(
    @Inject(INVENTORY_MASTER_WRITE_ACCESS) private readonly access: InventoryMasterWriteAccess,
    @Inject(INVENTORY_CATEGORY_STATUS_WRITER)
    private readonly writer: InventoryCategoryStatusWriter,
  ) {}

  async execute(categoryId: unknown, input: unknown, context: InventoryCategoryStatusContext) {
    const scope = await this.access.authorize(context.identity);
    const target = entityIdParamsSchema.safeParse({ id: categoryId });
    const parsed = setInventoryCategoryStatusSchema.safeParse(input);
    if (!target.success || !parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "The category lifecycle command is invalid.",
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
      return inventoryCategorySchema.parse(
        await this.writer.setStatus(scope, target.data.id.toLowerCase(), parsed.data, {
          idempotencyKey: key.data,
          origin: {
            ...context.origin,
            channel: channel.data,
            ...(request?.success ? { requestId: request.data } : {}),
          },
        }),
      );
    } catch (error) {
      if (error instanceof InventoryCategoryWriteError) {
        if (error.code === "INVENTORY_CATEGORY_NOT_FOUND")
          throw new NotFoundException({
            code: error.code,
            message: "The requested category definition is unavailable.",
          });
        throw new ConflictException({
          code: error.code,
          message:
            "The category lifecycle command conflicts with a saved request. Check its outcome before retrying.",
        });
      }
      throw error;
    }
  }
}
