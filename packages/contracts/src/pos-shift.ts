import * as z from "zod";

import { moneyMinorSchema, positiveMoneyMinorSchema, signedMoneyMinorSchema } from "./money.ts";

// POS shift (register session)

export const registerSessionStatusSchema = z.enum(["OPEN", "CLOSED"]);

export const cashMovementDirectionSchema = z.enum(["IN", "OUT"]);

export const cashMovementSchema = z.object({
  amountMinor: positiveMoneyMinorSchema,
  createdAt: z.iso.datetime(),
  direction: cashMovementDirectionSchema,
  id: z.uuid(),
  reason: z.string().min(1).max(300),
});

/**
 * A shift as the cashier sees it. Totals and variance are derived by the
 * server and are never accepted as input.
 */
export const registerSessionSchema = z.object({
  cashInMinor: moneyMinorSchema,
  cashOutMinor: moneyMinorSchema,
  /** Cash payments taken during the shift. */
  /** Cash refunds paid out of the drawer during the shift. */
  cashRefundsMinor: moneyMinorSchema,
  cashSalesMinor: moneyMinorSchema,
  /** Non-cash payments taken in the shift, per method; methods without payments are left out. */
  nonCashPayments: z.array(
    z.object({
      amountMinor: positiveMoneyMinorSchema,
      method: z.enum(["MERCHANT_QRIS", "TRANSFER", "EDC", "OTHER"]),
    }),
  ),
  closedAt: z.iso.datetime().nullable(),
  countedCashMinor: moneyMinorSchema.nullable(),
  expectedCashMinor: signedMoneyMinorSchema,
  id: z.uuid(),
  movements: z.array(cashMovementSchema),
  openedAt: z.iso.datetime(),
  openedByName: z.string().min(1).max(160),
  openingCashMinor: moneyMinorSchema,
  outletId: z.uuid(),
  status: registerSessionStatusSchema,
  varianceMinor: signedMoneyMinorSchema.nullable(),
  varianceReason: z.string().min(1).max(500).nullable(),
});

export const currentRegisterSessionSchema = z.object({
  session: registerSessionSchema.nullable(),
});

export const openRegisterSessionSchema = z.object({
  openingCashMinor: moneyMinorSchema,
});

export const recordCashMovementSchema = z.object({
  amountMinor: positiveMoneyMinorSchema,
  direction: cashMovementDirectionSchema,
  reason: z.string().trim().min(3).max(300),
});

export const closeRegisterSessionSchema = z.object({
  countedCashMinor: moneyMinorSchema,
  varianceReason: z.string().trim().min(3).max(500).optional(),
});

export type CashMovement = z.infer<typeof cashMovementSchema>;

export type CashMovementDirection = z.infer<typeof cashMovementDirectionSchema>;

export type CloseRegisterSession = z.infer<typeof closeRegisterSessionSchema>;

export type CurrentRegisterSession = z.infer<typeof currentRegisterSessionSchema>;

export type OpenRegisterSession = z.infer<typeof openRegisterSessionSchema>;

export type RecordCashMovement = z.infer<typeof recordCashMovementSchema>;

export type RegisterSession = z.infer<typeof registerSessionSchema>;

export type RegisterSessionStatus = z.infer<typeof registerSessionStatusSchema>;
