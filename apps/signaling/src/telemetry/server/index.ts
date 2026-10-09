import { loadObservabilityConfig } from "./config.js";
import { StructuredLogger } from "./logger.js";
import { SecurityTracker } from "./security.js";
import type { SecurityEvent, StructuredLog } from "../types.js";

export interface ServerObservability {
  config: ReturnType<typeof loadObservabilityConfig>;
  logger: StructuredLogger;
  security: SecurityTracker;
  shutdown: () => Promise<void>;
}

export function createServerObservability(): ServerObservability {
  const config = loadObservabilityConfig();
  const logger = new StructuredLogger(config);
  const security = new SecurityTracker(config);

  logger.addSink((entry: StructuredLog) => {
    process.stdout.write(JSON.stringify(entry) + "\n");
  });

  security.addSink((event: SecurityEvent) => {
    process.stdout.write(JSON.stringify(event) + "\n");
  });

  return {
    config,
    logger,
    security,
    shutdown: async () => {},
  };
}

export { loadObservabilityConfig } from "./config.js";
export type { SecurityEvent, StructuredLog } from "../types.js";
