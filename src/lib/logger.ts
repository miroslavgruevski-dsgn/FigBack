type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    emit({ level: "info", message, ...meta });
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit({ level: "warn", message, ...meta });
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit({ level: "error", message, ...meta });
  },
};
