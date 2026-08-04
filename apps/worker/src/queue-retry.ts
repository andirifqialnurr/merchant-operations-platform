export type RetryDecisionInput = {
  attempt: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type RetryDecision =
  | {
      action: "retry";
      nextAttempt: number;
      delayMs: number;
    }
  | {
      action: "dead-letter";
      finalAttempt: number;
    };

export type DeadLetterEvent = {
  jobName: string;
  attempt: number;
  maxAttempts: number;
  failedAt: string;
  errorName: string;
  errorMessage: string;
  context: DeadLetterContext;
};

export type DeadLetterContext = {
  [key: string]: string | number | boolean | null | DeadLetterContext | DeadLetterContext[];
};

export type DeadLetterInput = {
  jobName: string;
  attempt: number;
  maxAttempts: number;
  failedAt: Date;
  error: unknown;
  context?: Record<string, unknown>;
};

const SENSITIVE_CONTEXT_KEY =
  /(authorization|cookie|password|payload|raw|secret|session|signature|token)/i;

export function nextRetryDecision(input: RetryDecisionInput): RetryDecision {
  if (input.attempt >= input.maxAttempts) {
    return {
      action: "dead-letter",
      finalAttempt: input.attempt,
    };
  }

  const multiplier = 2 ** Math.max(input.attempt - 1, 0);

  return {
    action: "retry",
    nextAttempt: input.attempt + 1,
    delayMs: Math.min(input.baseDelayMs * multiplier, input.maxDelayMs),
  };
}

export function buildDeadLetterEvent(input: DeadLetterInput): DeadLetterEvent {
  const error = normalizeError(input.error);

  return {
    jobName: input.jobName,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    failedAt: input.failedAt.toISOString(),
    errorName: error.name,
    errorMessage: error.message,
    context: sanitizeDeadLetterContext(input.context ?? {}, { allowTopLevelDrop: true }),
  };
}

export function sanitizeDeadLetterContext(
  context: Record<string, unknown>,
  options: { allowTopLevelDrop?: boolean } = {},
): DeadLetterContext {
  return sanitizeObject(context, options.allowTopLevelDrop === true, 0);
}

function sanitizeObject(
  context: Record<string, unknown>,
  allowTopLevelDrop: boolean,
  depth: number,
): DeadLetterContext {
  const safeContext: DeadLetterContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_CONTEXT_KEY.test(key)) {
      if (allowTopLevelDrop && depth === 0) {
        continue;
      }

      throw new Error(`Sensitive dead letter context key is not allowed: ${key}`);
    }

    const safeValue = sanitizeValue(value, allowTopLevelDrop, depth + 1);

    if (safeValue !== undefined) {
      safeContext[key] = safeValue;
    }
  }

  return safeContext;
}

function sanitizeValue(
  value: unknown,
  allowTopLevelDrop: boolean,
  depth: number,
): DeadLetterContext[string] | undefined {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return value as string | number | boolean | null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, allowTopLevelDrop, depth))
      .filter(isDefined) as DeadLetterContext[];
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeObject(value as Record<string, unknown>, allowTopLevelDrop, depth);
  }

  return undefined;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : "Unknown worker queue error",
  };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
