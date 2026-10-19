import process from "node:process";
import { withReceiptFixture } from "./receipt-fixture.mjs";

let stop;
const stopped = new Promise((resolve) => {
  stop = resolve;
});
process.on("message", (message) => {
  if (message?.type === "stop") stop();
});
process.on("disconnect", () => stop());
try {
  await withReceiptFixture(
    async ({ data }) => {
      process.send?.({ type: "ready", data });
      await stopped;
    },
    { port: Number(process.env.E2E_RECEIPT_API_PORT ?? "4101"), webURL: "http://localhost:4100" },
  );
} catch (error) {
  process.send?.({
    type: "failed",
    message: error instanceof Error ? error.message : "Receipt fixture failed.",
  });
  process.exitCode = 1;
} finally {
  process.disconnect?.();
}
