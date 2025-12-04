import type { HeadersInit } from "bun";
import Fastify from "fastify";
import { replay, type Client } from "./index";
import { recordAlgosdkRequests } from "./record";

export type ServerInstance = {
  port: number;
  close: () => Promise<void>;
  listen: Promise<string>;
};

const TESTNET_URLS = {
  algod: "https://testnet-api.4160.nodely.dev",
  kmd: "http://localhost:4002", // KMD not available on public networks
  indexer: "https://testnet-idx.4160.nodely.dev"
};

const DEFAULT_PORTS = {
  algod: 8000,
  kmd: 8001,
  indexer: 8002
};

export async function startServer(
  client: Client,
  recordingsDir?: string
): Promise<ServerInstance> {
  await recordAlgosdkRequests(client, "record-new", recordingsDir);

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname"
              }
            }
          : undefined
    }
  });

  // Catch-all proxy through PollyJS
  fastify.all("/*", async (request, reply) => {
    const url = new URL(request.url, TESTNET_URLS[client]);

    fastify.log.debug(
      `[Fastify] Incoming request: ${request.method} ${request.url}`
    );
    fastify.log.debug(`[Fastify] Transformed to: ${request.method} ${url}`);

    const forwardHeaders = [
      "x-algo-api-token",
      "x-indexer-api-token",
      "x-kmd-api-token",
      "accept"
    ];

    for (const [key, value] of Object.entries(request.headers)) {
      fastify.log.debug(`[Fastify] Request header: ${key} = ${value}`);

      if (!forwardHeaders.includes(key.toLowerCase())) {
        delete request.headers[key];
      }
    }

    fastify.log.debug(
      `[Fastify] Forwarded headers: ${JSON.stringify(request.headers)}`
    );

    let response;
    try {
      response = await replay(
        client,
        async () =>
          await fetch(url, {
            method: request.method,
            headers: request.headers as HeadersInit,
            body:
              request.method !== "GET" && request.method !== "HEAD"
                ? JSON.stringify(request.body)
                : undefined
          }),
        recordingsDir
      );
    } catch (e) {
      reply.status(500).send(JSON.stringify(e));
      return;
    }

    // Handle binary msgpack responses correctly - use arrayBuffer() instead of text()
    // to avoid UTF-8 corruption of binary data
    const contentType = response.headers.get("content-type") || "";
    const isBinary = contentType.includes("msgpack") || contentType.includes("octet-stream");
    const data = isBinary
      ? Buffer.from(await response.arrayBuffer())
      : await response.text();

    fastify.log.debug(`[PollyJS] Response status: ${response.status}`);
    fastify.log.debug(`[PollyJS] Response content-type: ${contentType}`);
    fastify.log.debug(`[PollyJS] Response is binary: ${isBinary}`);
    fastify.log.debug(`[PollyJS] Response size: ${isBinary ? (data as Buffer).length : (data as string).length} bytes`);

    if (!isBinary) {
      const preview = (data as string).length > 200 ? (data as string).substring(0, 200) + "..." : data;
      fastify.log.debug(`[PollyJS] Response preview: ${preview}`);
    }

    reply
      .code(response.status)
      .headers(Object.fromEntries(response.headers.entries()))
      .send(data);
  });

  const port =
    Number(process.env[`${client.toUpperCase()}_PORT`]) ||
    DEFAULT_PORTS[client];

  // Start listening without awaiting (non-blocking)
  const listenPromise = fastify.listen({
    port,
    host: "0.0.0.0"
  });

  await fastify.ready();

  // Return close function for graceful shutdown
  return {
    port,
    close: async () => {
      await fastify.close();
    },
    listen: listenPromise
  };
}
