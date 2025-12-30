import Fastify from "fastify";
import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  },
});

const mswServer = setupServer(...handlers);
mswServer.listen({
  onUnhandledRequest(request, print) {
    fastify.log.warn(
      `[MSW] ⚠️  UNHANDLED REQUEST: ${request.method} ${request.url}`
    );
    print.warning();
  },
});

// Log when requests match handlers
mswServer.events.on("request:start", ({ request }) => {
  fastify.log.debug(
    `[MSW] 🔍 Attempting to match: ${request.method} ${request.url}`
  );
});

mswServer.events.on("request:match", ({ request, requestId }) => {
  fastify.log.debug(
    `[MSW] ✅ Handler matched: ${request.method} ${request.url}`
  );
  fastify.log.debug(`[MSW]    Request ID: ${requestId}`);
});

mswServer.events.on("request:unhandled", ({ request }) => {
  fastify.log.warn(
    `[MSW] ❌ No handler matched: ${request.method} ${request.url}`
  );
});

mswServer.events.on("response:mocked", ({ request, response, requestId }) => {
  fastify.log.debug(
    `[MSW] 📤 Mocked response for: ${request.method} ${request.url}`
  );
  fastify.log.debug(
    `[MSW]    Status: ${response.status} ${response.statusText}`
  );
  fastify.log.debug(`[MSW]    Request ID: ${requestId}`);
});

// Catch-all proxy through MSW
fastify.all("/*", async (request, reply) => {
  // TODO: Determine how to properly handle query parameters
  // Currently stripping all query params to allow HAR handlers to match
  // Some endpoints may need query params for different responses (e.g., pagination, filtering)
  // Consider:
  // - Environment variable to toggle query param stripping
  // - Allowlist/blocklist of query params to strip (e.g., only strip 'format')
  // - HAR handler enhancement to support wildcard query param matching
  const parsedUrl = new URL(request.url, "http://mock");
  const url = `http://mock${parsedUrl.pathname}`; // Strip query parameters

  fastify.log.debug(
    `[Fastify] Incoming request: ${request.method} ${request.url}`
  );
  fastify.log.debug(`[Fastify] Transformed to: ${request.method} ${url}`);

  const response = await fetch(url, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? JSON.stringify(request.body)
        : undefined,
  });

  const data = await response.text();

  fastify.log.debug(`[MSW] Response status: ${response.status}`);
  fastify.log.debug(`[MSW] Response size: ${data.length} bytes`);

  // Log response preview (first 200 chars)
  const preview = data.length > 200 ? data.substring(0, 200) + "..." : data;
  fastify.log.debug(`[MSW] Response preview: ${preview}`);

  reply
    .code(response.status)
    .headers(Object.fromEntries(response.headers.entries()))
    .send(data);
});

await fastify.listen({
  port: Number(process.env.PORT) || 8000,
  host: "0.0.0.0",
});
