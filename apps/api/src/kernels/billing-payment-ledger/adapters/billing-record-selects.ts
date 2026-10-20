export const billSelect = {
  chargesIncluded: true,
  currency: true,
  discountMinor: true,
  id: true,
  orderId: true,
  paidMinor: true,
  roundingMinor: true,
  serviceChargeMinor: true,
  serviceChargeRateBp: true,
  status: true,
  subtotalMinor: true,
  tableSessionId: true,
  taxMinor: true,
  taxRateBp: true,
  totalMinor: true,
} as const;

export const paymentSelect = {
  amountMinor: true,
  confirmedAt: true,
  id: true,
  method: true,
  reference: true,
  status: true,
  tenderedMinor: true,
} as const;

export const saleSelect = {
  completedAt: true,
  id: true,
  saleNumber: true,
  status: true,
  totalMinor: true,
} as const;

export const refundSelect = {
  amountMinor: true,
  createdAt: true,
  id: true,
  method: true,
  reason: true,
} as const;
