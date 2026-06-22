/**
 * src/utils/logger.js
 *
 * Shared Pino logger instance.
 * Imported by middleware, routes and services — avoids circular dependency
 * with index.js which also needs to import from middleware.
 */

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});
