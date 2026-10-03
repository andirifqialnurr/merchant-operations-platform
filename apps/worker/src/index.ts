import { createWorkerRuntime } from "@merchant/api/worker-runtime";
import { Queue, QueueEvents, Worker, type Job } from "bullmq";

import { startOutboxLoop } from "./outbox-loop.js";
import { DEFAULT_JOB_OPTIONS, queueConnection, QUEUES, retryDelayMs } from "./queues.js";

const HEARTBEAT_JOB = "heartbeat";
const SMOKE_TIMEOUT_MS = 15_000;
/** How long the dispatcher rests when the outbox is empty, and after a failure. */
const OUTBOX_IDLE_MS = 1_000;
const OUTBOX_ERROR_MS = 5_000;
const isSmokeCheck = process.argv.includes("--smoke");

/** Jobs of the worker's own queue. Unknown names fail loudly instead of passing silently. */
async function processSystemJob(job: Job) {
  if (job.name === HEARTBEAT_JOB) return { receivedAt: new Date().toISOString() };
  throw new Error(`No handler for system job "${job.name}".`);
}

function startSystemWorker() {
  const worker = new Worker(QUEUES.system, processSystemJob, {
    connection: queueConnection(process.env.REDIS_URL),
    settings: { backoffStrategy: retryDelayMs },
  });
  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.name ?? "unknown"} (${job?.id ?? "?"}) failed: ${error.message}`);
  });
  worker.on("error", (error) => {
    console.error(`Worker connection problem: ${error.message}`);
  });
  return worker;
}

/** Sends one heartbeat through Redis and waits for the worker to finish it. */
async function runSmokeCheck(worker: Worker) {
  const connection = queueConnection(process.env.REDIS_URL);
  const queue = new Queue(QUEUES.system, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
  const events = new QueueEvents(QUEUES.system, { connection });
  try {
    await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
    const job = await queue.add(HEARTBEAT_JOB, {});
    await job.waitUntilFinished(events, SMOKE_TIMEOUT_MS);
  } finally {
    await Promise.all([events.close(), queue.close()]);
  }
}

/** Fails instead of waiting forever, e.g. when Redis cannot be reached. */
async function withDeadline<T>(work: Promise<T>, milliseconds: number, message: string) {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const worker = startSystemWorker();
  // The API's own modules, so event handlers call the same use cases the API does.
  const runtime = await createWorkerRuntime();
  console.info(
    `Worker started; event handlers: ${runtime.handlerNames.join(", ") || "none registered"}`,
  );

  if (isSmokeCheck) {
    // On failure the catch below exits at once; closing would wait on a dead Redis.
    await withDeadline(
      runSmokeCheck(worker),
      SMOKE_TIMEOUT_MS,
      "Worker smoke check failed: no answer from Redis in time.",
    );
    // One pass over the outbox proves the database side of the dispatcher too.
    const taken = await runtime.dispatchBatch();
    console.info(`Worker smoke check completed; outbox events delivered: ${taken}`);
    await Promise.all([worker.close(), runtime.close()]);
    return;
  }

  const outbox = startOutboxLoop({
    dispatchBatch: runtime.dispatchBatch,
    errorMs: OUTBOX_ERROR_MS,
    idleMs: OUTBOX_IDLE_MS,
    onError: (error) => {
      console.error(
        `Outbox dispatcher problem: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });

  const shutdown = (signal: NodeJS.Signals) => {
    // Stop claiming first, let what is in progress finish, then let go of the connections.
    void outbox
      .stop()
      .then(() => worker.close())
      .then(() => runtime.close())
      .then(() => {
        console.info(`Worker stopped after ${signal}`);
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
