export type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

function write(
  level: "debug" | "info" | "warn" | "error",
  scope: string,
  message: string,
  context?: LogContext
) {
  const prefix = `[Lily][${scope}] ${message}`;

  if (context && Object.keys(context).length > 0) {
    console[level](prefix, context);
  } else {
    console[level](prefix);
  }
}

export function createLogger(scope: string) {
  return {
    debug(message: string, context?: LogContext) {
      write("debug", scope, message, context);
    },
    info(message: string, context?: LogContext) {
      write("info", scope, message, context);
    },
    warn(message: string, context?: LogContext) {
      write("warn", scope, message, context);
    },
    error(message: string, error?: unknown, context?: LogContext) {
      write("error", scope, message, {
        ...context,
        error: serializeError(error),
      });
    },
  };
}
