export const SERVER_ACKNOWLEDGED_OPERATIONS = [
  "submit-order",
  "payment-confirmation",
  "refund",
  "stock-adjustment",
  "approval",
  "shift-closing",
] as const;

export type ServerAcknowledgedOperation = (typeof SERVER_ACKNOWLEDGED_OPERATIONS)[number];

export type ServerAcknowledgementState = {
  online: boolean;
  serverAcknowledged: boolean;
};

const operationLabels: Record<ServerAcknowledgedOperation, string> = {
  approval: "Approval",
  "payment-confirmation": "Pembayaran",
  refund: "Pembayaran",
  "shift-closing": "Shift closing",
  "stock-adjustment": "Stok",
  "submit-order": "Order",
};

export function isServerAcknowledgedOperation(value: string): value is ServerAcknowledgedOperation {
  return SERVER_ACKNOWLEDGED_OPERATIONS.some((operation) => operation === value);
}

export function assertServerAcknowledgement(
  operation: ServerAcknowledgedOperation,
  state: ServerAcknowledgementState,
) {
  if (!state.online || !state.serverAcknowledged) {
    throw new Error(`${operationLabels[operation]} membutuhkan konfirmasi server.`);
  }

  return {
    operation,
    serverAcknowledged: true as const,
  };
}
