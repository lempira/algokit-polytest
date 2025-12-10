/* eslint-disable no-console */

import { GetPendingTransactions } from "@algorandfoundation/algokit-utils/packages/algod_client/src/models/get-pending-transactions";

import { OnApplicationComplete } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/app-call";
import * as path from "path";
import { z } from "zod";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import {
  pendingAppCallFromSenderSchema,
  pendingAppCallToAppSchema,
  pendingAppCallToAppWithOnCompleteSchema,
  pendingAppCallTransactionsSchema,
  pendingAppCallWithAccountReferencesSchema,
  pendingAppCallWithAppReferencesSchema,
  pendingAppCallWithArgsSchema,
  pendingAppCallWithAssetReferencesSchema,
  pendingAppCallWithBoxReferencesSchema,
  pendingAppCallWithMinArgsSchema,
  pendingAppClearStateSchema,
  pendingAppCloseOutSchema,
  pendingAppCreationSchema,
  pendingAppCreationWithBothStateSchemasSchema,
  pendingAppCreationWithExtraPagesSchema,
  pendingAppDeleteSchema,
  pendingAppNoOpSchema,
  pendingAppOptInSchema,
  pendingAppUpdateSchema
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
 * Example: App Call Multi-Schema Matching with Tagging and JSON Output
 *
 * This example demonstrates how to:
 * 1. Match against multiple app call schemas with OR logic (union)
 * 2. Tag each match with all schemas it satisfies
 * 3. Save matched responses to a JSON file
 *
 * Use cases:
 * - Tracking app creation (new smart contracts being deployed)
 * - Monitoring app updates (contract upgrades)
 * - Detecting app deletions (cleanup operations)
 * - Watching opt-ins/close-outs (user interactions)
 * - Tracking calls with specific arguments (protocol-specific monitoring)
 * - Monitoring foreign references usage (composability tracking)
 */
async function main() {
  // Create AlgorandClient
  const algorand = AlgorandClient.fromConfig({
    algodConfig: { server: "https://mainnet-api.4160.nodely.dev/" }
  });

  // Create poller instance
  const poller = new AlgorandPoller(algorand);

  // Define all app call schemas to test
  const schemas = {
    // Static schemas
    pendingAppCallTransactionsSchema,
    pendingAppCreationSchema,
    pendingAppUpdateSchema,
    pendingAppDeleteSchema,
    pendingAppOptInSchema,
    pendingAppCloseOutSchema,
    pendingAppClearStateSchema,
    pendingAppNoOpSchema,
    pendingAppCallWithArgsSchema,
    pendingAppCallWithAccountReferencesSchema,
    pendingAppCallWithAppReferencesSchema,
    pendingAppCallWithAssetReferencesSchema,
    pendingAppCallWithBoxReferencesSchema,
    pendingAppCreationWithBothStateSchemasSchema,
    pendingAppCreationWithExtraPagesSchema,

    // Parameterized schemas with example values
    // Note: These use example app IDs/addresses/arguments - customize as needed
    pendingAppCallToAppSchema: pendingAppCallToAppSchema(1002541853n), // Example: Folks Finance app ID on Algorand mainnet
    pendingAppCallFromSenderSchema: pendingAppCallFromSenderSchema(
      "EXAMPLE_SENDER_ADDRESS"
    ),
    pendingAppCallToAppWithOnCompleteSchema:
      pendingAppCallToAppWithOnCompleteSchema(
        1002541853n,
        OnApplicationComplete.NoOp
      ),
    pendingAppCallWithMinArgsSchema: pendingAppCallWithMinArgsSchema(1)
  };

  // Create union schema: matches if ANY schema matches
  const unionSchema = z.union([
    schemas.pendingAppCallTransactionsSchema,
    schemas.pendingAppCreationSchema,
    schemas.pendingAppUpdateSchema,
    schemas.pendingAppDeleteSchema,
    schemas.pendingAppOptInSchema,
    schemas.pendingAppCloseOutSchema,
    schemas.pendingAppClearStateSchema,
    schemas.pendingAppNoOpSchema,
    schemas.pendingAppCallWithArgsSchema,
    schemas.pendingAppCallWithAccountReferencesSchema,
    schemas.pendingAppCallWithAppReferencesSchema,
    schemas.pendingAppCallWithAssetReferencesSchema,
    schemas.pendingAppCallWithBoxReferencesSchema,
    schemas.pendingAppCreationWithBothStateSchemasSchema,
    schemas.pendingAppCreationWithExtraPagesSchema,
    schemas.pendingAppCallToAppSchema,
    schemas.pendingAppCallFromSenderSchema,
    schemas.pendingAppCallToAppWithOnCompleteSchema,
    schemas.pendingAppCallWithMinArgsSchema
  ]);

  // Initialize JSON logger
  const timestamp = `${new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]}T${new Date().toISOString().split("T")[1].split(".")[0].replace(/:/g, "")}`;
  const outputPath = path.join(
    __dirname,
    "output",
    "get-pending-transactions",
    "app-call-transactions",
    `${timestamp}.json`
  );
  const logger = new MatchLogger(outputPath);

  console.log(`Output will be saved to: ${outputPath}\n`);

  // Set up event listeners
  poller.on("poller:started", (event: PollerStartedEvent) => {
    console.log(`Poller started at round ${event.startRound}`);
    console.log(`Testing ${Object.keys(schemas).length} app call schemas\n`);
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
  console.log("Starting app call multi-schema poller...");
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
