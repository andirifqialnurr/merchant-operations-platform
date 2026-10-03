export type OutboxLoopOptions = {
  /** Delivers one batch and returns how many events it took. */
  dispatchBatch: () => Promise<number>;
  /** Wait after an empty batch. */
  idleMs: number;
  onError: (error: unknown) => void;
  /** Wait after a failed batch, so a broken database is not hammered. */
  errorMs: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type OutboxLoop = {
  /** Stops claiming, lets the batch in progress finish, then resolves. */
  stop(): Promise<void>;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Keeps delivering outbox events: straight on while there is work, with a
 * pause when the outbox is empty or a batch failed.
 */
export function startOutboxLoop(options: OutboxLoopOptions): OutboxLoop {
  const sleep = options.sleep ?? wait;
  let stopping = false;

  const run = async () => {
    while (!stopping) {
      try {
        const taken = await options.dispatchBatch();
        if (taken === 0 && !stopping) await sleep(options.idleMs);
      } catch (error) {
        options.onError(error);
        if (!stopping) await sleep(options.errorMs);
      }
    }
  };
  const finished = run();

  return {
    stop: async () => {
      stopping = true;
      await finished;
    },
  };
}
