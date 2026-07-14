const isSmokeCheck = process.argv.includes("--smoke");

function startWorker() {
  console.info("Worker started");

  if (isSmokeCheck) {
    console.info("Worker smoke check completed");
    return;
  }

  const keepAlive = setInterval(() => undefined, 60_000);

  const shutdown = (signal: NodeJS.Signals) => {
    clearInterval(keepAlive);
    console.info(`Worker stopped after ${signal}`);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startWorker();
