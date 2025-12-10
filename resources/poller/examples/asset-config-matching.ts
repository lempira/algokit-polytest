/* eslint-disable no-console */

import { GetPendingTransactions } from "@algorandfoundation/algokit-utils/packages/algod_client/src/models/get-pending-transactions";

import * as path from "path";
import { z } from "zod";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import {
  pendingAssetConfigByManagerSchema,
  pendingAssetConfigFromSenderSchema,
  pendingAssetConfigOfAssetSchema,
  pendingAssetConfigRemovingClawbackSchema,
  pendingAssetConfigRemovingFreezeSchema,
  pendingAssetConfigRemovingManagerSchema,
  pendingAssetConfigSettingClawbackSchema,
  pendingAssetConfigSettingFreezeSchema,
  pendingAssetConfigSettingManagerSchema,
  pendingAssetConfigSettingReserveSchema,
  pendingAssetConfigTransactionsSchema,
  pendingAssetConfigWithClawbackSchema,
  pendingAssetConfigWithFreezeSchema,
  pendingAssetConfigWithManagerSchema,
  pendingAssetCreationSchema,
  pendingAssetCreationWithNameSchema,
  pendingAssetCreationWithUnitNameSchema,
  pendingAssetDestroySchema,
  pendingAssetReconfigurationSchema
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
 * Example: Asset Config Multi-Schema Matching with Tagging and JSON Output
 *
 * This example demonstrates how to:
 * 1. Match against multiple asset config schemas with OR logic (union)
 * 2. Tag each match with all schemas it satisfies
 * 3. Save matched responses to a JSON file
 *
 * Use cases:
 * - Tracking asset creation (new tokens/NFTs)
 * - Monitoring asset reconfiguration (governance changes)
 * - Detecting asset destruction (cleanup operations)
 * - Identifying manager/freeze/clawback changes (security monitoring)
 * - Watching for capability removal (immutability events)
 */
async function main() {
  // Create AlgorandClient
  const algorand = AlgorandClient.fromConfig({
    algodConfig: { server: "https://mainnet-api.4160.nodely.dev/" }
  });

  // Create poller instance
  const poller = new AlgorandPoller(algorand);

  // Define all asset config schemas to test
  const schemas = {
    // Static schemas
    pendingAssetConfigTransactionsSchema,
    pendingAssetCreationSchema,
    pendingAssetReconfigurationSchema,
    pendingAssetDestroySchema,
    pendingAssetConfigWithManagerSchema,
    pendingAssetConfigWithFreezeSchema,
    pendingAssetConfigWithClawbackSchema,
    pendingAssetConfigRemovingManagerSchema,
    pendingAssetConfigRemovingFreezeSchema,
    pendingAssetConfigRemovingClawbackSchema,

    // Parameterized schemas with example values
    // Note: These use example addresses/values - customize as needed
    pendingAssetConfigOfAssetSchema: pendingAssetConfigOfAssetSchema(31566704n), // Example: USDC asset ID on Algorand mainnet
    pendingAssetConfigFromSenderSchema: pendingAssetConfigFromSenderSchema(
      "EXAMPLE_SENDER_ADDRESS"
    ),
    pendingAssetConfigByManagerSchema: pendingAssetConfigByManagerSchema(
      "EXAMPLE_MANAGER_ADDRESS"
    ),
    pendingAssetCreationWithNameSchema:
      pendingAssetCreationWithNameSchema("Example Token"),
    pendingAssetCreationWithUnitNameSchema:
      pendingAssetCreationWithUnitNameSchema("EXT"),
    pendingAssetConfigSettingManagerSchema:
      pendingAssetConfigSettingManagerSchema("EXAMPLE_NEW_MANAGER_ADDRESS"),
    pendingAssetConfigSettingReserveSchema:
      pendingAssetConfigSettingReserveSchema("EXAMPLE_RESERVE_ADDRESS"),
    pendingAssetConfigSettingFreezeSchema:
      pendingAssetConfigSettingFreezeSchema("EXAMPLE_FREEZE_ADDRESS"),
    pendingAssetConfigSettingClawbackSchema:
      pendingAssetConfigSettingClawbackSchema("EXAMPLE_CLAWBACK_ADDRESS")
  };

  // Create union schema: matches if ANY schema matches
  const unionSchema = z.union([
    schemas.pendingAssetConfigTransactionsSchema,
    schemas.pendingAssetCreationSchema,
    schemas.pendingAssetReconfigurationSchema,
    schemas.pendingAssetDestroySchema,
    schemas.pendingAssetConfigWithManagerSchema,
    schemas.pendingAssetConfigWithFreezeSchema,
    schemas.pendingAssetConfigWithClawbackSchema,
    schemas.pendingAssetConfigRemovingManagerSchema,
    schemas.pendingAssetConfigRemovingFreezeSchema,
    schemas.pendingAssetConfigRemovingClawbackSchema,
    schemas.pendingAssetConfigOfAssetSchema,
    schemas.pendingAssetConfigFromSenderSchema,
    schemas.pendingAssetConfigByManagerSchema,
    schemas.pendingAssetCreationWithNameSchema,
    schemas.pendingAssetCreationWithUnitNameSchema,
    schemas.pendingAssetConfigSettingManagerSchema,
    schemas.pendingAssetConfigSettingReserveSchema,
    schemas.pendingAssetConfigSettingFreezeSchema,
    schemas.pendingAssetConfigSettingClawbackSchema
  ]);

  // Initialize JSON logger
  const timestamp = `${new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]}T${new Date().toISOString().split("T")[1].split(".")[0].replace(/:/g, "")}`;
  const outputPath = path.join(
    __dirname,
    "output",
    "get-pending-transactions",
    "asset-config-transactions",
    `${timestamp}.json`
  );
  const logger = new MatchLogger(outputPath);

  console.log(`Output will be saved to: ${outputPath}\n`);

  // Set up event listeners
  poller.on("poller:started", (event: PollerStartedEvent) => {
    console.log(`Poller started at round ${event.startRound}`);
    console.log(
      `Testing ${Object.keys(schemas).length} asset config schemas\n`
    );
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
  console.log("Starting asset config multi-schema poller...");
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
