type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  event: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export function logStructured(level: LogLevel, payload: LogPayload) {
  const message = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}
