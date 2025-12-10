/* eslint-disable no-console */

import { GetPendingTransactions } from "@algorandfoundation/algokit-utils/packages/algod_client/src/models/get-pending-transactions";

import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import {
  anyPendingTransactionsSchema,
  pendingAppCallTransactionsSchema,
  pendingAppCallWithAccountReferencesSchema,
  pendingAppCallWithAppReferencesSchema,
  pendingAppCallWithArgsSchema,
  pendingAppCallWithAssetReferencesSchema,
  pendingAppCallWithBoxReferencesSchema,
  pendingAppClearStateSchema,
  pendingAppCloseOutSchema,
  pendingAppCreationSchema,
  pendingAppCreationWithBothStateSchemasSchema,
  pendingAppCreationWithExtraPagesSchema,
  pendingAppDeleteSchema,
  pendingAppNoOpSchema,
  pendingAppOptInSchema,
  pendingAppUpdateSchema,
  pendingAssetClawbackSchema,
  pendingAssetConfigRemovingClawbackSchema,
  pendingAssetConfigRemovingFreezeSchema,
  pendingAssetConfigRemovingManagerSchema,
  pendingAssetConfigTransactionsSchema,
  pendingAssetConfigWithClawbackSchema,
  pendingAssetConfigWithFreezeSchema,
  pendingAssetConfigWithManagerSchema,
  pendingAssetCreationSchema,
  pendingAssetDestroySchema,
  pendingAssetFreezeSchema,
  pendingAssetFreezeTransactionsSchema,
  pendingAssetReconfigurationSchema,
  pendingAssetTransferTransactionsSchema,
  pendingAssetTransferWithCloseOutSchema,
  pendingAssetUnfreezeSchema,
  pendingKeyRegistrationTransactionsSchema,
  pendingKeyRegistrationWithSelectionKeySchema,
  pendingKeyRegistrationWithStateProofKeySchema,
  pendingKeyRegistrationWithVoteKeySchema,
  pendingOfflineKeyRegistrationSchema,
  pendingOnlineKeyRegistrationSchema,
  pendingPaymentTransactionsSchema,
  pendingPaymentWithCloseOutSchema,
  pendingPaymentWithNoteSchema
} from "../schemas";
import { testMultipleSchemas } from "../schemas/utils/schema-matcher";
import { AlgorandPoller } from "../src/algorand-poller";
import type {
  PollerErrorEvent,
  PollerMatchEvent,
  PollerPollEvent,
  PollerStoppedEvent,
  PollerTimeoutEvent
} from "../src/poller-types";
import { MatchLogger } from "./utils/match-logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * State file structure for persisting schema coverage across runs
 */
interface SchemaCoverageState {
  /**
   * Array of schema names that have been matched in any run
   */
  matchedSchemas: string[];

  /**
   * Timestamp of last update (for debugging/info purposes)
   */
  lastUpdated?: string;
}

/**
 * Schema Coverage Tracker
 *
 * Tracks which schemas have been matched during polling and provides
 * coverage statistics and unmatched schema reporting.
 */
class SchemaCoverageTracker {
  private matchedSchemas: Set<string> = new Set();
  private allSchemaNames: string[];
  private statePath: string | null = null;

  constructor(schemaNames: string[]) {
    this.allSchemaNames = schemaNames;
  }

  /**
   * Set the path for state persistence
   * Must be called before using load() or save()
   */
  setStatePath(path: string): void {
    this.statePath = path;
  }

  /**
   * Load previously matched schemas from state file
   * Returns the number of schemas loaded
   * Handles missing files, corrupted JSON, and schema validation
   */
  async load(): Promise<number> {
    if (!this.statePath) {
      throw new Error("State path not set. Call setStatePath() first.");
    }

    try {
      const fs = await import("fs/promises");
      const data = await fs.readFile(this.statePath, "utf-8");
      const state: SchemaCoverageState = JSON.parse(data);

      // Validate that loaded schemas are in our current schema list
      // This handles cases where schemas are removed/renamed
      let loadedCount = 0;
      for (const schemaName of state.matchedSchemas) {
        if (this.allSchemaNames.includes(schemaName)) {
          this.matchedSchemas.add(schemaName);
          loadedCount++;
        }
      }

      return loadedCount;
    } catch (error) {
      // File doesn't exist or is corrupted - start fresh
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return 0; // No previous state, start fresh
      }

      // Log warning for corrupted files but don't fail
      console.warn(
        `Warning: Could not load state file (${error}). Starting with empty state.`
      );
      return 0;
    }
  }

  /**
   * Save current matched schemas to state file
   * Creates directory structure if needed
   */
  async save(): Promise<void> {
    if (!this.statePath) {
      throw new Error("State path not set. Call setStatePath() first.");
    }

    try {
      const fs = await import("fs/promises");
      const pathModule = await import("path");

      // Ensure directory exists
      const dir = pathModule.dirname(this.statePath);
      await fs.mkdir(dir, { recursive: true });

      // Create state object
      const state: SchemaCoverageState = {
        matchedSchemas: Array.from(this.matchedSchemas),
        lastUpdated: new Date().toISOString()
      };

      // Write to file with pretty formatting
      await fs.writeFile(
        this.statePath,
        JSON.stringify(state, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error(`Failed to save state file: ${error}`);
      // Don't throw - we don't want to crash the poller if state save fails
    }
  }

  /**
   * Mark schemas as matched and save state
   * Returns true if any NEW schemas were matched
   */
  async markMatched(schemaNames: string[]): Promise<boolean> {
    const previousCount = this.matchedSchemas.size;
    schemaNames.forEach((name) => this.matchedSchemas.add(name));
    const hadNewMatches = this.matchedSchemas.size > previousCount;

    // Auto-save if we have new matches and state path is configured
    if (hadNewMatches && this.statePath) {
      await this.save();
    }

    return hadNewMatches;
  }

  /**
   * Get count of matched schemas
   */
  getMatchedCount(): number {
    return this.matchedSchemas.size;
  }

  /**
   * Get total count of schemas being tracked
   */
  getTotalCount(): number {
    return this.allSchemaNames.length;
  }

  /**
   * Check if all schemas have been matched
   */
  isAllMatched(): boolean {
    return this.matchedSchemas.size === this.allSchemaNames.length;
  }

  /**
   * Get list of schemas that haven't been matched yet
   */
  getUnmatchedSchemas(): string[] {
    return this.allSchemaNames.filter((name) => !this.matchedSchemas.has(name));
  }

  /**
   * Get coverage percentage as formatted string
   */
  getCoveragePercent(): string {
    return (
      (this.matchedSchemas.size / this.allSchemaNames.length) *
      100
    ).toFixed(2);
  }
}

/**
 * Example: Comprehensive Schema Coverage Testing with Persistence
 *
 * This example demonstrates how to:
 * 1. Test against ALL pending transaction schemas simultaneously
 * 2. Track which schemas have been matched across polling iterations
 * 3. Persist matched schemas across restarts (state is saved to disk)
 * 4. Highlight coverage improvements with dedicated console output
 * 5. Generate idempotent JSON output (no timestamps)
 * 6. Report unmatched schemas for debugging
 *
 * Use cases:
 * - Comprehensive testing of schema definitions
 * - Validating schema coverage for different transaction types
 * - Identifying which transaction patterns are common vs rare
 * - Debugging schema definitions that never match
 * - Long-running coverage monitoring across multiple sessions
 */
async function main() {
  // Create AlgorandClient - using mainnet for real transaction diversity
  const algorand = AlgorandClient.fromConfig({
    algodConfig: { server: "https://mainnet-api.4160.nodely.dev/" }
  });

  // All schemas to test - generic schemas only (no specific parameters)
  const allSchemas = {
    // Base schema
    anyPendingTransactionsSchema,

    // Payment schemas
    pendingPaymentTransactionsSchema,
    pendingPaymentWithNoteSchema,
    pendingPaymentWithCloseOutSchema,

    // Asset Transfer schemas
    pendingAssetTransferTransactionsSchema,
    pendingAssetTransferWithCloseOutSchema,
    pendingAssetClawbackSchema,

    // Asset Config schemas
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

    // Asset Freeze schemas
    pendingAssetFreezeTransactionsSchema,
    pendingAssetFreezeSchema,
    pendingAssetUnfreezeSchema,

    // App Call schemas
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

    // Key Registration schemas
    pendingKeyRegistrationTransactionsSchema,
    pendingOnlineKeyRegistrationSchema,
    pendingOfflineKeyRegistrationSchema,
    pendingKeyRegistrationWithVoteKeySchema,
    pendingKeyRegistrationWithSelectionKeySchema,
    pendingKeyRegistrationWithStateProofKeySchema
  };

  // Create schema coverage tracker
  const tracker = new SchemaCoverageTracker(Object.keys(allSchemas));

  // Initialize state path for persistence
  const statePath = path.join(
    __dirname,
    "output",
    "get-pending-transactions",
    "schema-coverage-state.json"
  );
  tracker.setStatePath(statePath);

  // Load previous state if it exists
  const loadedCount = await tracker.load();
  if (loadedCount > 0) {
    console.log(
      `Loaded ${loadedCount} previously matched schemas from state file`
    );
  }

  // Create union schema for poller (matches if ANY schema matches)
  const unionSchema = z.union(Object.values(allSchemas));

  // Initialize JSON logger (idempotent output path - no timestamp)
  const outputPath = path.join(
    __dirname,
    "output",
    "get-pending-transactions",
    "schema-coverage.json"
  );
  const logger = new MatchLogger(outputPath);

  // Create poller instance
  const poller = new AlgorandPoller(algorand);

  console.log("=== Pending Transactions Schema Coverage Example ===");
  console.log(`Output will be saved to: ${outputPath}`);
  console.log();

  // Set up event listeners
  poller.on("poller:started", () => {
    console.log("Schema Coverage Poller Started");
    console.log(`Total schemas to test: ${tracker.getTotalCount()}`);

    // Show initial progress if we loaded previous state
    const alreadyMatched = tracker.getMatchedCount();
    if (alreadyMatched > 0) {
      console.log(
        `Starting coverage: ${alreadyMatched}/${tracker.getTotalCount()} (${tracker.getCoveragePercent()}%)`
      );
    }

    console.log("Polling every 2 seconds...\n");
  });

  poller.on("poller:poll", (event: PollerPollEvent<GetPendingTransactions>) => {
    const matched = tracker.getMatchedCount();
    const total = tracker.getTotalCount();
    const txnCount = event.response?.totalTransactions ?? 0;
    console.log(
      `Poll #${event.pollCount} - ${txnCount} txns - Coverage: ${matched}/${total} (${tracker.getCoveragePercent()}%)${event.matched ? " - Match found" : ""}`
    );
  });

  poller.on(
    "poller:match",
    async (event: PollerMatchEvent<GetPendingTransactions>) => {
      const result = testMultipleSchemas(event.response, allSchemas);

      // Track coverage before update
      const previousCount = tracker.getMatchedCount();
      const previousPercent = tracker.getCoveragePercent();

      // Update tracker with newly matched schemas
      const hadNewMatches = await tracker.markMatched(result.matchedSchemas);

      // Log to file
      await logger.logMatch({
        timestamp: "",
        round: event.round.toString(),
        pollCount: event.pollCount,
        matchedSchemas: result.matchedSchemas,
        response: event.response
      });

      console.log(
        `  Matched ${result.matchedSchemas.length} schema(s) in this response`
      );

      // Highlight coverage improvement with dedicated console output
      if (hadNewMatches) {
        const newCount = tracker.getMatchedCount();
        const newPercent = tracker.getCoveragePercent();
        const schemasAdded = newCount - previousCount;

        console.log("\n========================================");
        console.log("Coverage improved");
        console.log(
          `   New: ${newCount}/${tracker.getTotalCount()} (${newPercent}%) [+${schemasAdded} schema${schemasAdded > 1 ? "s" : ""}]`
        );
        console.log(
          `   Previously: ${previousCount}/${tracker.getTotalCount()} (${previousPercent}%)`
        );
        console.log("========================================\n");
      } else {
        console.log(
          `  → Coverage: ${tracker.getMatchedCount()}/${tracker.getTotalCount()} (${tracker.getCoveragePercent()}%)`
        );
      }
    }
  );

  poller.on("poller:timeout", (event: PollerTimeoutEvent) => {
    console.log(`\nTimeout after ${event.pollCount} polls`);
    console.log(
      `Only ${tracker.getMatchedCount()}/${tracker.getTotalCount()} schemas matched before timeout`
    );
  });

  poller.on("poller:stopped", async (event: PollerStoppedEvent) => {
    // Save final state
    await tracker.save();

    console.log(`\n=== Schema Coverage Report ===`);
    console.log(`Reason: ${event.reason}`);
    console.log(`Total polls: ${event.pollCount}`);
    console.log(`Final round: ${event.finalRound}`);
    console.log(
      `\nCoverage: ${tracker.getMatchedCount()}/${tracker.getTotalCount()} schemas (${tracker.getCoveragePercent()}%)`
    );

    const unmatched = tracker.getUnmatchedSchemas();
    if (unmatched.length > 0) {
      console.log(`\nUnmatched schemas (${unmatched.length}):`);
      unmatched.forEach((schema) => console.log(`  - ${schema}`));
    } else {
      console.log("\nAll schemas matched");
    }

    console.log(`\nResults saved to: ${outputPath}`);
    console.log(`State saved to: ${statePath}`);
  });

  poller.on("poller:error", (event: PollerErrorEvent) => {
    console.error(`Error in poll #${event.pollCount}: ${event.error.message}`);
  });

  // Start polling
  console.log("Starting comprehensive schema coverage poller...");
  console.log(
    "(Will run continuously until timeout or manual stop - coverage is persisted)\n"
  );

  await poller.start({
    endpoint: (algorand) =>
      algorand.client.algod.getPendingTransactions({ max: 1000 }),
    query: unionSchema,
    pollStrategy: { type: "interval", intervalMs: 2000 }, // Poll every 2 seconds
    timeout: { type: "time", value: 1800000 } // 30 minutes
  });

  // The poller runs asynchronously in the background
  // The process will stay alive until:
  // - Timeout occurs (30 minutes)
  // - Manual stop via Ctrl+C
  // Coverage is persisted across restarts
}

main().catch(console.error);
