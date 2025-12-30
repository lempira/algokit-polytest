import { HttpHandler } from "msw";
import { fromOpenApi } from "@mswjs/source/open-api";
import { fromTraffic } from "@mswjs/source/traffic";
import { customHandlers } from "./handlers/custom/index.js";
import algodSpec from "../algod.oas3.json" assert { type: "json" };
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Loads all .har files from the recordings directory and converts them to MSW handlers.
 * URLs are automatically transformed to use http://mock as the base URL.
 */
async function getHarHandlers(): Promise<HttpHandler[]> {
  const recordingsDir = join(__dirname, "../recordings");
  const harHandlers: HttpHandler[] = [];

  try {
    const harFiles = readdirSync(recordingsDir).filter((file) =>
      file.endsWith(".har")
    );

    for (const file of harFiles) {
      const harPath = join(recordingsDir, file);
      if (existsSync(harPath)) {
        logger.info(`Loading HAR file: ${harPath}`);
      }

      // Read and parse the HAR file
      const harContent = readFileSync(harPath, "utf-8");
      const har = JSON.parse(harContent);

      // Transform URLs to use http://mock
      const handlers = fromTraffic(har, (entry) => {
        const url = new URL(entry.request.url);
        const originalUrl = entry.request.url;
        // Rewrite to our mock server
        entry.request.url = `http://mock${url.pathname}${url.search}`;

        logger.debug(
          `  Transformed HAR entry: ${entry.request.method} ${originalUrl} -> ${entry.request.url}`
        );

        // Remove content-encoding header since HAR responses are already decompressed
        if (entry.response.headers) {
          entry.response.headers = entry.response.headers.filter(
            (header) => header.name.toLowerCase() !== "content-encoding"
          );
        }

        return entry;
      });

      logger.info(`  Created ${handlers.length} handlers from ${file}`);
      harHandlers.push(...handlers);
    }
  } catch (error) {
    // No HAR files yet or directory doesn't exist, continue without them
    logger.warn(
      { err: error },
      "No HAR recordings found, continuing without HAR handlers"
    );
  }

  return harHandlers;
}

// Layer 2: HAR recordings
const harHandlers = await getHarHandlers();
logger.info(`Total HAR handlers loaded: ${harHandlers.length}`);

// Layer 3: OpenAPI-generated handlers (baseline)
// Modify the spec to use our mock server URL
const mockSpec = {
  ...algodSpec,
  servers: [{ url: "http://mock" }],
};
const openApiHandlers = await fromOpenApi(mockSpec as any);
logger.info(`Total OpenAPI handlers loaded: ${openApiHandlers.length}`);

// Add metadata to handlers for debugging
const taggedCustomHandlers = customHandlers.map((handler, i) => {
  (handler as any).__source = `Custom[${i}]`;
  return handler;
});

const taggedHarHandlers = harHandlers.map((handler, i) => {
  (handler as any).__source = `HAR[${i}]`;
  return handler;
});

const taggedOpenApiHandlers = openApiHandlers.map((handler, i) => {
  (handler as any).__source = `OpenAPI[${i}]`;
  return handler;
});

export const handlers: HttpHandler[] = [
  // Layer 1: Custom handlers (highest priority)
  ...taggedCustomHandlers,

  // Layer 2: HAR recordings (loaded dynamically from recordings/)
  ...taggedHarHandlers,

  // Layer 3: OpenAPI baseline (fallback)
  ...taggedOpenApiHandlers,
];

logger.info(
  `Total handlers: ${handlers.length} (Custom: ${customHandlers.length}, HAR: ${harHandlers.length}, OpenAPI: ${openApiHandlers.length})`
);
