import { z } from "zod";
import type { AlgorandClient, Logger } from "@algorandfoundation/algokit-utils";

/**
 * Timeout configuration for poller
 */
export type PollerTimeout =
  | { type: "rounds"; value: number }
  | { type: "time"; value: number }
  | { type: "none" };

/**
 * Strategy for when to poll the blockchain
 */
export type PollStrategy =
  | { type: "round" } // Wait for new blockchain rounds
  | { type: "interval"; intervalMs: number }; // Poll at fixed time intervals

/**
 * Configuration for a single polling operation
 *
 * @example
 * ```typescript
 * const config: PollerConfig = {
 *   endpoint: (algorand) => algorand.client.algod.getPendingTransactions({ max: 1000 }),
 *   query: GetPendingTransactionsSchema.refine(
 *     (data) => data.totalTransactions > 0,
 *     { message: 'Must have at least one pending transaction' }
 *   ),
 *   timeout: { type: 'rounds', value: 100 }
 * }
 * ```
 */
export interface PollerConfig<T = unknown> {
  /**
   * Unique identifier for this poller instance.
   * Auto-generated if not provided.
   */
  id?: string;

  /**
   * Function that takes AlgorandClient and returns a Promise of the endpoint response.
   *
   * @example
   * ```typescript
   * endpoint: (algorand) => algorand.client.algod.getPendingTransactions({ max: 1000 })
   * ```
   */
  endpoint: (client: AlgorandClient) => Promise<T>;

  /**
   * Zod schema with optional refinements for matching/validating responses.
   * Can use modelMetadataToZodSchema() or custom schema.
   *
   * @example
   * ```typescript
   * query: modelMetadataToZodSchema(GetPendingTransactionsMeta)
   *   .refine((data) => data.totalTransactions > 0)
   * ```
   */
  query: z.ZodType<T>;

  /**
   * Maximum time or rounds to poll before timing out.
   * @default { type: 'rounds', value: 1000 }
   */
  timeout?: PollerTimeout;

  /**
   * Optional polling interval in milliseconds (minimum time between polls).
   * @default 0 (poll as fast as possible using waitForBlock)
   */
  minPollInterval?: number;

  /**
   * Strategy for when to poll the blockchain.
   * @default { type: 'round' }
   */
  pollStrategy?: PollStrategy;

  /**
   * Custom logger for this poller (overrides Config.logger).
   */
  logger?: Logger;
}

/**
 * Event payload for 'poller:match' event
 */
export interface PollerMatchEvent<T = unknown> {
  /**
   * Poller instance ID
   */
  pollerId: string;

  /**
   * The response that matched the query
   */
  response: T;

  /**
   * Round number when match occurred
   */
  round: bigint;

  /**
   * Timestamp when match occurred
   */
  timestamp: Date;

  /**
   * Number of polls attempted before match
   */
  pollCount: number;
}

/**
 * Event payload for 'poller:poll' event (debugging)
 */
export interface PollerPollEvent<T = unknown> {
  /**
   * Poller instance ID
   */
  pollerId: string;

  /**
   * Current round being polled (may be undefined in interval mode if algod call fails)
   */
  round?: bigint;

  /**
   * Response from endpoint
   */
  response: T;

  /**
   * Whether query matched
   */
  matched: boolean;

  /**
   * Zod validation result
   */
  validation: { success: boolean; data?: T; error?: z.ZodError<T> };

  /**
   * Number of polls so far
   */
  pollCount: number;
}

/**
 * Event payload for 'poller:error' event
 */
export interface PollerErrorEvent {
  /**
   * Poller instance ID
   */
  pollerId: string;

  /**
   * The error that occurred
   */
  error: Error;

  /**
   * Round number when error occurred (may be undefined in interval mode)
   */
  round?: bigint;

  /**
   * Number of polls attempted before error
   */
  pollCount: number;
}

/**
 * Event payload for 'poller:timeout' event
 */
export interface PollerTimeoutEvent {
  /**
   * Poller instance ID
   */
  pollerId: string;

  /**
   * Timeout configuration that was exceeded
   */
  timeout: PollerTimeout;

  /**
   * Final round reached
   */
  finalRound: bigint;

  /**
   * Total polls attempted
   */
  pollCount: number;
}

/**
 * Event payload for 'poller:stopped' event
 */
export interface PollerStoppedEvent {
  /**
   * Poller instance ID
   */
  pollerId: string;

  /**
   * Reason for stopping
   */
  reason: "timeout" | "error" | "manual";

  /**
   * Final round reached
   */
  finalRound: bigint;

  /**
   * Total polls attempted
   */
  pollCount: number;
}

/**
 * Event payload for 'poller:started' event
 */
export interface PollerStartedEvent {
  /**
   * Poller instance ID
   */
  pollerId: string;

  /**
   * Starting round (undefined if using interval strategy)
   */
  startRound?: bigint;

  /**
   * Configuration used
   */
  config: PollerConfig;
}

/**
 * State of a poller instance
 */
export enum PollerState {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  ERROR = "ERROR"
}

/**
 * Poller instance status information
 */
export interface PollerStatus {
  /**
   * Poller instance ID
   */
  id: string;

  /**
   * Current state
   */
  state: PollerState;

  /**
   * Current round (if running)
   */
  currentRound?: bigint;

  /**
   * Starting round
   */
  startRound?: bigint;

  /**
   * Number of polls completed
   */
  pollCount: number;

  /**
   * Number of matches found
   */
  matchCount: number;

  /**
   * Number of errors encountered
   */
  errorCount: number;

  /**
   * Time started
   */
  startTime?: Date;

  /**
   * Last poll time
   */
  lastPollTime?: Date;

  /**
   * Time of next scheduled poll (only for interval strategy)
   */
  nextPollTime?: Date;

  /**
   * Configuration
   */
  config: PollerConfig;
}
