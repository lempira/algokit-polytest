/* eslint-disable no-console */

import { GetPendingTransactions } from "@algorandfoundation/algokit-utils/packages/algod_client/src/models/get-pending-transactions";

import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import * as path from "path";
import { z } from "zod";
import {
  pendingPaymentBetweenAddressesSchema,
  pendingPaymentFromSenderSchema,
  pendingPaymentToReceiverSchema,
  pendingPaymentTransactionsSchema,
  pendingPaymentWithCloseOutFromSenderSchema,
  pendingPaymentWithCloseOutSchema,
  pendingPaymentWithCloseOutToAddressSchema,
  pendingPaymentWithMinAmountSchema,
  pendingPaymentWithNotePrefixSchema,
  pendingPaymentWithNoteSchema,
  pendingPaymentWithSpecificNoteSchema
} from "../schemas";
import { testMultipleSchemas } from "../schemas/utils/schema-matcher";
import { AlgorandPoller } from "../src/algorand-poller";
import type {
  PollerErrorEvent,
  PollerMatchEvent,
  PollerPollEvent,
  PollerStartedEvent,
  PollerStoppedEvent,
  PollerTimeoutEvent
} from "../src/poller-types";
import { MatchLogger } from "./utils/match-logger";

/**
 * Example: Payment Multi-Schema Matching with Tagging and JSON Output
 *
 * This example demonstrates how to:
 * 1. Match against multiple payment schemas with OR logic (union)
 * 2. Tag each match with all schemas it satisfies
 * 3. Save matched responses to a JSON file
 *
 * Use cases:
 * - Tracking payment transactions on the network
 * - Monitoring payments to/from specific addresses
 * - Detecting payments with notes or minimum amounts
 * - Identifying close-out operations
 */
async function main() {
  // Create AlgorandClient
  const algorand = AlgorandClient.fromConfig({
    algodConfig: { server: "https://mainnet-api.4160.nodely.dev/" }
  });

  // Create poller instance
  const poller = new AlgorandPoller(algorand);

  // Define all payment schemas to test
  const schemas = {
    // Static schemas
    pendingPaymentTransactionsSchema,
    pendingPaymentWithNoteSchema,
    pendingPaymentWithCloseOutSchema,

    // Parameterized schemas with example values
    // Note: These use example addresses/values - customize as needed
    pendingPaymentToReceiverSchema: pendingPaymentToReceiverSchema(
      "EXAMPLE_RECEIVER_ADDRESS"
    ),
    pendingPaymentFromSenderSchema: pendingPaymentFromSenderSchema(
      "EXAMPLE_SENDER_ADDRESS"
    ),
    pendingPaymentWithMinAmountSchema:
      pendingPaymentWithMinAmountSchema(1_000_000n), // 1 ALGO
    pendingPaymentBetweenAddressesSchema: pendingPaymentBetweenAddressesSchema(
      "EXAMPLE_SENDER",
      "EXAMPLE_RECEIVER"
    ),
    pendingPaymentWithSpecificNoteSchema: pendingPaymentWithSpecificNoteSchema(
      new Uint8Array([1, 2, 3])
    ),
    pendingPaymentWithNotePrefixSchema: pendingPaymentWithNotePrefixSchema(
      new Uint8Array([1])
    ),
    pendingPaymentWithCloseOutToAddressSchema:
      pendingPaymentWithCloseOutToAddressSchema("EXAMPLE_CLOSE_ADDRESS"),
    pendingPaymentWithCloseOutFromSenderSchema:
      pendingPaymentWithCloseOutFromSenderSchema("EXAMPLE_SENDER_ADDRESS")
  };

  // Create union schema: matches if ANY schema matches
  const unionSchema = z.union([
    schemas.pendingPaymentTransactionsSchema,
    schemas.pendingPaymentWithNoteSchema,
    schemas.pendingPaymentWithCloseOutSchema,
    schemas.pendingPaymentToReceiverSchema,
    schemas.pendingPaymentFromSenderSchema,
    schemas.pendingPaymentWithMinAmountSchema,
    schemas.pendingPaymentBetweenAddressesSchema,
    schemas.pendingPaymentWithSpecificNoteSchema,
    schemas.pendingPaymentWithNotePrefixSchema,
    schemas.pendingPaymentWithCloseOutToAddressSchema,
    schemas.pendingPaymentWithCloseOutFromSenderSchema
  ]);

  // Initialize JSON logger
  const timestamp = `${new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]}T${new Date().toISOString().split("T")[1].split(".")[0].replace(/:/g, "")}`;
  const outputPath = path.join(
    __dirname,
    "output",
    "get-pending-transactions",
    "payment-transactions",
    `${timestamp}.json`
  );
  const logger = new MatchLogger(outputPath);

  console.log(`Output will be saved to: ${outputPath}\n`);

  // Set up event listeners
  poller.on("poller:started", (event: PollerStartedEvent) => {
    console.log(`Poller started at round ${event.startRound}`);
    console.log(`Testing ${Object.keys(schemas).length} payment schemas\n`);
  });

  poller.on("poller:poll", (event: PollerPollEvent<GetPendingTransactions>) => {
    const totalTxns = event.response?.totalTransactions ?? 0;
    console.log(
      `Polling round ${event.round} (poll #${event.pollCount}) - ${totalTxns} transactions${event.matched ? " - Match found" : ""}`
    );
  });

  poller.on(
    "poller:match",
    async (event: PollerMatchEvent<GetPendingTransactions>) => {
      const result = testMultipleSchemas(event.response, schemas);

      await logger.logMatch({
        timestamp: event.timestamp.toISOString(),
        round: event.round.toString(),
        pollCount: event.pollCount,
        matchedSchemas: result.matchedSchemas,
        response: event.response
      });

      console.log(`Saved: ${result.matchedSchemas.length} schemas matched`);
    }
  );

  poller.on("poller:timeout", (event: PollerTimeoutEvent) => {
    console.log(`\nTimeout after ${event.pollCount} polls`);
  });

  poller.on("poller:stopped", (event: PollerStoppedEvent) => {
    console.log(`Poller stopped: ${event.reason}`);
  });

  poller.on("poller:error", (event: PollerErrorEvent) => {
    console.error(`Error: ${event.error.message}`);
  });

  // Start polling
  console.log("Starting payment multi-schema poller...");
  console.log(
    "(Polling every 1 second, will timeout after 5 minutes if no matches found)\n"
  );

  await poller.start({
    endpoint: (algorand) =>
      algorand.client.algod.getPendingTransactions({ max: 1000 }),
    query: unionSchema,
    pollStrategy: { type: "interval", intervalMs: 1000 }, // Poll every 1 second
    timeout: { type: "time", value: 300000 } // 5 minutes
  });

  // The poller runs asynchronously in the background
  // The process will stay alive until the poller stops (via timeout, error, or manual stop)
  // The event handlers will manage finalization
}

main().catch(console.error);
