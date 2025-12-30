import { Polly, type PollyConfig } from "@pollyjs/core";
import FetchAdapter from "@pollyjs/adapter-fetch";
import FSPersister from "@pollyjs/persister-fs";
import path from "path";

Polly.register(FSPersister);
Polly.register(FetchAdapter);

export type Client = "algod" | "kmd" | "indexer";

// Normalize URLs for ID calculation - treat MainNet and localhost as TestNet
const normalizeUrl = (url: string) => {
  return url
    .replace(
      "https://mainnet-api.4160.nodely.dev",
      "https://testnet-api.4160.nodely.dev"
    )
    .replace("http://localhost:4001", "https://testnet-api.4160.nodely.dev");
};

export function getPolly(
  client: Client,
  config: {
    mode: "record-new" | "record-overwrite" | "replay";
    recordingsDir?: string;
  }
) {
  const pollyConfig: PollyConfig = {
    adapters: ["fetch"],
    persister: "fs",
    persisterOptions: {
      fs: {
        recordingsDir:
          config.recordingsDir ?? path.resolve(__dirname, "../recordings")
      }
    },
    matchRequestsBy: {
      method: true,
      url: normalizeUrl, // Normalize URLs for consistent ID generation
      headers: true,
      body: true,
      order: false
    }
  };

  if (config.mode === "record-new") {
    pollyConfig.mode = "replay";
    pollyConfig.recordIfMissing = true;
  } else if (config.mode === "record-overwrite") {
    pollyConfig.mode = "record";
  } else if (config.mode === "replay") {
    pollyConfig.mode = "replay";
    pollyConfig.recordIfMissing = false;
  } else {
    throw new Error(`Unknown mode: ${config.mode}`);
  }

  const polly = new Polly(client, pollyConfig);

  // Store msgpack bodies during recording so they can be persisted
  // Key: request URL, Value: base64-encoded body
  const msgpackBodies = new Map<string, string>();

  // Encode binary msgpack responses as base64 before persisting to HAR
  polly.server.any().on("beforePersist", (_req, rec) => {
    const contentType = rec.response.headers.find(
      (h: any) => h.name.toLowerCase() === "content-type"
    )?.value;

    if (contentType?.includes("msgpack")) {
      console.log("beforePersist: msgpack detected for", rec.request.url);

      // Retrieve the body we stored during beforeResponse
      const storedBody = msgpackBodies.get(rec.request.url);

      if (storedBody) {
        rec.response.content.text = storedBody;
        rec.response.content.encoding = "base64";
        console.log(
          "  Retrieved stored msgpack body, length:",
          storedBody.length
        );
        // Clean up
        msgpackBodies.delete(rec.request.url);
      } else {
        console.log("  WARNING: No stored body found for msgpack response!");
      }
    }

    // Rewrite localhost URLs to production URLs before saving to HAR
    // This allows recording against localhost (where test data exists) while storing
    // production-like URLs that match what the mock server expects during replay
    if (rec.request.url.includes("http://localhost:4001")) {
      rec.request.url = rec.request.url.replace(
        "http://localhost:4001",
        "https://testnet-api.4160.nodely.dev"
      );
    }

    // Rewrite MainNet URLs to TestNet URLs
    // This allows recording from MainNet but matching based on path (as TestNet) during replay
    if (rec.request.url.includes("https://mainnet-api.4160.nodely.dev")) {
      rec.request.url = rec.request.url.replace(
        "https://mainnet-api.4160.nodely.dev",
        "https://testnet-api.4160.nodely.dev"
      );
    }
  });

  const headersToRemove = [
    "transfer-encoding", // Conflicts with content-length header during replay
    "content-encoding", // HAR stores decompressed body but header indicates compression (e.g. gzip), causing decompression errors
    "content-length" // Let the server calculate the correct content-length for the response
  ];
  polly.server.any().on("beforeReplay", (_req, rec) => {
    rec.response.headers = rec.response.headers.filter(
      (h: any) => !headersToRemove.includes(h.name.toLowerCase())
    );
  });

  // Handle msgpack response bodies for both recording and replay
  polly.server.any().on("beforeResponse", (req, res) => {
    console.log("beforeResponse triggered");
    console.log("Content-Type:", res.headers["content-type"]);
    console.log("Body type:", typeof res.body);
    console.log(
      "Body (first 50 chars):",
      typeof res.body === "string" ? res.body.substring(0, 50) : "NOT A STRING"
    );

    const contentType = res.headers["content-type"];

    if (contentType?.includes("msgpack") && res.body) {
      if (polly.mode === "record") {
        // During recording, body arrives as base64 string from PollyJS
        if (typeof res.body === "string") {
          console.log("RECORD mode: storing msgpack body");
          // Store the base64 string for persistence
          msgpackBodies.set(req.url, res.body);
          console.log(
            "  Stored msgpack for:",
            req.url,
            "length:",
            res.body.length
          );
          // Decode to binary for algosdk to consume
          const buffer = Buffer.from(res.body, "base64");
          res.body = new Uint8Array(buffer) as any;
          console.log("  Converted to Uint8Array for SDK");
        }
      } else {
        // During replay, decode base64 string back to binary
        if (typeof res.body === "string") {
          console.log("REPLAY mode: decoding base64 to msgpack");
          const buffer = Buffer.from(res.body, "base64");
          res.body = new Uint8Array(buffer) as any;
          console.log("  Decoded body type:", res.body?.constructor.name);
        }
      }
    }
  });

  return polly;
}

export async function record(
  client: Client,
  makeRequests: () => Promise<void>,
  mode: "record-new" | "record-overwrite" = "record-new",
  recordingsDir?: string
) {
  const polly = getPolly(client, { mode, recordingsDir });
  try {
    await makeRequests();
  } finally {
    await polly.stop();
  }
}

export async function replay<T>(
  client: Client,
  makeRequests: () => Promise<T>,
  recordingsDir?: string
): Promise<T> {
  const polly = getPolly(client, { mode: "replay", recordingsDir });

  try {
    return await makeRequests();
  } finally {
    await polly.stop();
  }
}
