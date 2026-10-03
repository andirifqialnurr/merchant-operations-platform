import assert from "node:assert/strict";
import test from "node:test";

import { startOutboxLoop } from "./outbox-loop.js";

/** A sleep the test controls: the loop waits until `release` is called. */
function controlledSleep() {
  const waits: number[] = [];
  let release: () => void = () => undefined;
  return {
    release: () => release(),
    sleep: (milliseconds: number) => {
      waits.push(milliseconds);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    waits,
  };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("keeps going while there is work and pauses when the outbox is empty", async () => {
  const batches = [3, 2, 0];
  const control = controlledSleep();
  let calls = 0;
  const loop = startOutboxLoop({
    dispatchBatch: async () => {
      calls += 1;
      return batches.shift() ?? 0;
    },
    errorMs: 5_000,
    idleMs: 1_000,
    onError: () => assert.fail("no error expected"),
    sleep: control.sleep,
  });

  await tick();
  // Two full batches were taken back to back; the pause came only after the empty one.
  assert.equal(calls, 3);
  assert.deepEqual(control.waits, [1_000]);

  const stopped = loop.stop();
  control.release();
  await stopped;
  assert.equal(calls, 3);
});

test("a failed batch is reported, followed by a longer pause, and the loop goes on", async () => {
  const errors: unknown[] = [];
  const control = controlledSleep();
  let calls = 0;
  const loop = startOutboxLoop({
    dispatchBatch: async () => {
      calls += 1;
      if (calls === 1) throw new Error("database unreachable");
      return 0;
    },
    errorMs: 5_000,
    idleMs: 1_000,
    onError: (error) => errors.push(error),
    sleep: control.sleep,
  });

  await tick();
  assert.equal(errors.length, 1);
  assert.deepEqual(control.waits, [5_000]);

  control.release();
  await tick();
  assert.equal(calls, 2);
  assert.deepEqual(control.waits, [5_000, 1_000]);

  const stopped = loop.stop();
  control.release();
  await stopped;
});

test("stopping waits for the batch in progress", async () => {
  let finishBatch: (taken: number) => void = () => undefined;
  let finished = false;
  const loop = startOutboxLoop({
    dispatchBatch: () =>
      new Promise<number>((resolve) => {
        finishBatch = (taken) => {
          finished = true;
          resolve(taken);
        };
      }),
    errorMs: 5_000,
    idleMs: 1_000,
    onError: () => assert.fail("no error expected"),
    sleep: async () => undefined,
  });

  await tick();
  let stopped = false;
  const stopping = loop.stop().then(() => {
    stopped = true;
  });
  await tick();
  assert.equal(stopped, false, "the batch is still running");

  finishBatch(4);
  await stopping;
  assert.equal(finished, true);
});
