import {
  Config,
  AlgorandClient,
  AsyncEventEmitter
} from "@algorandfoundation/algokit-utils";
import type { Logger } from "@algorandfoundation/algokit-utils";
import {
  PollerConfig,
  PollerErrorEvent,
  PollerMatchEvent,
  PollerPollEvent,
  PollerStartedEvent,
  PollerState,
  PollerStatus,
  PollerStoppedEvent,
  PollerTimeoutEvent
} from "./poller-types";

/**
 * Internal class managing a single poller instance
 */
class PollerInstance<T = unknown> {
  readonly id: string;
  readonly config: PollerConfig<T>;

  private state: PollerState = PollerState.IDLE;
  private pollingPromise?: Promise<void>;

  // Statistics
  private startRound?: bigint;
  private currentRound?: bigint;
  private pollCount = 0;
  private matchCount = 0;
  private errorCount = 0;
  private startTime?: Date;
  private lastPollTime?: Date;
  private nextPollTime?: Date;

  constructor(
    id: string,
    config: PollerConfig<T>,
    private algorand: AlgorandClient,
    private emitter: AsyncEventEmitter,
    private logger: Logger
  ) {
    this.id = id;
    this.config = {
      timeout: { type: "rounds", value: 1000 },
      minPollInterval: 0,
      pollStrategy: { type: "round" },
      ...config
    };

    // Validate configuration
    const strategy = this.config.pollStrategy!;

    if (strategy.type === "interval") {
      if (strategy.intervalMs <= 0) {
        throw new Error("pollStrategy.intervalMs must be positive");
      }

      if (this.config.minPollInterval && this.config.minPollInterval > 0) {
        this.logger.warn(
          "minPollInterval only applies to round-based polling. Use pollStrategy.intervalMs for interval-based polling."
        );
      }

      if (this.config.timeout?.type === "rounds") {
        this.logger.warn(
          "Use time-based timeout with interval poll strategy. Round-based timeout applies to round-based polling."
        );
      }
    }
  }

  async start(): Promise<void> {
    if (this.state === PollerState.RUNNING) {
      throw new Error(`Poller ${this.id} is already running`);
    }

    this.state = PollerState.RUNNING;
    this.startTime = new Date();

    const strategy = this.config.pollStrategy!;

    // Get starting round only for round-based strategy
    if (strategy.type === "round") {
      const status = await this.algorand.client.algod.getStatus();
      this.startRound = status.lastRound;
      this.currentRound = this.startRound;
    }

    // Emit started event
    void this.emitter.emitAsync("poller:started", {
      pollerId: this.id,
      startRound: this.startRound,
      config: this.config
    } as PollerStartedEvent);

    this.logger.info(
      `Poller ${this.id} started${this.startRound ? ` at round ${this.startRound}` : " in interval mode"}`
    );

    // Start polling loop
    this.pollingPromise = this.pollLoop().catch(() => {
      // Errors are handled via event emission; catch here to prevent unhandled rejection
    });
  }

  private async pollLoop(): Promise<void> {
    const strategy = this.config.pollStrategy!;

    if (strategy.type === "round") {
      await this.roundBasedPollLoop();
    } else {
      await this.intervalBasedPollLoop();
    }
  }

  private async roundBasedPollLoop(): Promise<void> {
    const startRound = this.startRound!;
    let stopReason: PollerStoppedEvent["reason"] = "manual";

    try {
      while (this.state === PollerState.RUNNING) {
        if (this.hasTimedOut(startRound)) {
          stopReason = this.handleTimeout();
          break;
        }

        await this.algorand.client.algod.waitForBlock(this.currentRound!);

        if (this.config.minPollInterval && this.config.minPollInterval > 0) {
          const timeSinceLastPoll = this.lastPollTime
            ? Date.now() - this.lastPollTime.getTime()
            : Infinity;

          if (timeSinceLastPoll < this.config.minPollInterval) {
            await new Promise((r) =>
              setTimeout(r, this.config.minPollInterval! - timeSinceLastPoll)
            );
          }
        }

        try {
          await this.executePoll();
        } catch (error) {
          this.handleError(error as Error);
        }

        this.currentRound = this.currentRound! + BigInt(1);
      }
    } catch (error) {
      this.logger.error(`Fatal error in poller ${this.id}:`, error);
      this.state = PollerState.ERROR;
      throw error;
    } finally {
      this.emitStoppedEvent(stopReason);
    }
  }

  private async intervalBasedPollLoop(): Promise<void> {
    const strategy = this.config.pollStrategy!;
    if (strategy.type !== "interval") return;

    const intervalMs = strategy.intervalMs;
    let stopReason: PollerStoppedEvent["reason"] = "manual";

    try {
      while (this.state === PollerState.RUNNING) {
        if (this.hasTimedOut()) {
          stopReason = this.handleTimeout();
          break;
        }

        this.nextPollTime = new Date(Date.now() + intervalMs);

        try {
          // Query current round for metadata (non-fatal)
          try {
            const status = await this.algorand.client.algod.getStatus();
            this.currentRound = status.lastRound;
          } catch (roundError) {
            this.logger.warn(`Failed to get current round: ${roundError}`);
            this.currentRound = undefined;
          }

          await this.executePoll();
        } catch (error) {
          this.handleError(error as Error);
        }

        await this.waitWithCancellation(intervalMs);
      }
    } catch (error) {
      this.logger.error(`Fatal error in poller ${this.id}:`, error);
      this.state = PollerState.ERROR;
      throw error;
    } finally {
      this.nextPollTime = undefined;
      this.emitStoppedEvent(stopReason);
    }
  }

  private async waitWithCancellation(ms: number): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + ms;

    while (Date.now() < endTime && this.state === PollerState.RUNNING) {
      const remaining = endTime - Date.now();
      const waitTime = Math.min(remaining, 100);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  private async executePoll(): Promise<void> {
    this.pollCount++;
    this.lastPollTime = new Date();

    // Call endpoint
    const response = await this.config.endpoint(this.algorand);

    // Validate with Zod schema
    const validation = this.config.query.safeParse(response);

    const matched = validation.success;

    // Emit poll event for debugging
    void this.emitter.emitAsync("poller:poll", {
      pollerId: this.id,
      round: this.currentRound!,
      response,
      matched,
      validation,
      pollCount: this.pollCount
    } as PollerPollEvent<T>);

    if (matched) {
      this.handleMatch(response);
    }
  }

  private handleMatch(response: T): void {
    this.matchCount++;

    // Emit match event
    void this.emitter.emitAsync("poller:match", {
      pollerId: this.id,
      response,
      round: this.currentRound!,
      timestamp: new Date(),
      pollCount: this.pollCount
    } as PollerMatchEvent<T>);

    this.logger.info(`Poller ${this.id} matched at round ${this.currentRound}`);

    // Polling continues after match - stop manually in event handler if needed
  }

  private handleError(error: Error): void {
    this.errorCount++;

    // Emit error event
    void this.emitter.emitAsync("poller:error", {
      pollerId: this.id,
      error,
      round: this.currentRound!,
      pollCount: this.pollCount
    } as PollerErrorEvent);

    this.logger.error(
      `Poller ${this.id} error at round ${this.currentRound}:`,
      error
    );
  }

  private hasTimedOut(startRound?: bigint): boolean {
    const timeout = this.config.timeout!;
    const strategy = this.config.pollStrategy!;

    switch (timeout.type) {
      case "none":
        return false;

      case "rounds":
        if (strategy.type !== "round" || !startRound || !this.currentRound) {
          // Invalid configuration - round-based timeout requires round-based polling
          return false;
        }
        return this.currentRound - startRound >= BigInt(timeout.value);

      case "time": {
        const elapsed = Date.now() - this.startTime!.getTime();
        return elapsed >= timeout.value;
      }
    }
  }

  private handleTimeout(): PollerStoppedEvent["reason"] {
    // Emit timeout event
    void this.emitter.emitAsync("poller:timeout", {
      pollerId: this.id,
      timeout: this.config.timeout!,
      finalRound: this.currentRound!,
      pollCount: this.pollCount
    } as PollerTimeoutEvent);

    this.logger.warn(
      `Poller ${this.id} timed out at round ${this.currentRound}`
    );

    return "timeout";
  }

  private emitStoppedEvent(reason: PollerStoppedEvent["reason"]): void {
    this.state = PollerState.STOPPED;

    // Emit stopped event
    void this.emitter.emitAsync("poller:stopped", {
      pollerId: this.id,
      reason,
      finalRound: this.currentRound!,
      pollCount: this.pollCount
    } as PollerStoppedEvent);

    this.logger.info(`Poller ${this.id} stopped: ${reason}`);
  }

  async stop(): Promise<void> {
    if (this.state === PollerState.STOPPED) return;

    // Signal the polling loop to stop
    this.state = PollerState.STOPPED;

    // Wait for polling loop to finish gracefully
    // The loop's finally block will emit the stopped event with reason='manual'
    await this.pollingPromise!.catch(() => {
      // Ignore errors as they're already logged in pollLoop
    });
  }

  getStatus(): PollerStatus {
    return {
      id: this.id,
      state: this.state,
      currentRound: this.currentRound,
      startRound: this.startRound,
      pollCount: this.pollCount,
      matchCount: this.matchCount,
      errorCount: this.errorCount,
      startTime: this.startTime,
      lastPollTime: this.lastPollTime,
      nextPollTime: this.nextPollTime,
      config: this.config
    };
  }
}

/**
 * Manages multiple concurrent Algorand endpoint pollers
 *
 * Supports two polling strategies:
 * - Round-based: Waits for blockchain blocks (default)
 * - Interval-based: Polls at fixed time intervals
 *
 * @example Basic round-based usage
 * ```typescript
 * const algorand = AlgorandClient.defaultLocalNet()
 * const poller = new AlgorandPoller(algorand)
 *
 * poller.on('poller:match', async (event) => {
 *   console.log('Match found:', event.response)
 *   await poller.stop(event.pollerId)
 * })
 *
 * await poller.start({
 *   endpoint: (algorand) => algorand.client.algod.getPendingTransactions({ max: 1000 }),
 *   query: schema,
 *   timeout: { type: 'rounds', value: 100 }
 * })
 * ```
 *
 * @example Interval-based polling
 * ```typescript
 * const algorand = AlgorandClient.defaultLocalNet()
 * const poller = new AlgorandPoller(algorand)
 *
 * await poller.start({
 *   endpoint: (algorand) => algorand.client.algod.getPendingTransactions({ max: 1000 }),
 *   query: schema,
 *   pollStrategy: { type: 'interval', intervalMs: 5000 }, // Poll every 5s
 *   timeout: { type: 'time', value: 60000 } // 1 minute timeout
 * })
 * ```
 *
 * @example Multiple concurrent pollers with different strategies
 * ```typescript
 * const algorand = AlgorandClient.defaultLocalNet()
 * const poller = new AlgorandPoller(algorand)
 *
 * // Round-based poller
 * await poller.start({
 *   id: 'round-poller',
 *   endpoint: (algorand) => algorand.client.algod.getPendingTransactions(),
 *   query: txSchema,
 *   pollStrategy: { type: 'round' },
 * })
 *
 * // Interval-based poller
 * await poller.start({
 *   id: 'interval-poller',
 *   endpoint: (algorand) => algorand.client.algod.accountInformation(address),
 *   query: accountSchema,
 *   pollStrategy: { type: 'interval', intervalMs: 10000 },
 * })
 * ```
 */
export class AlgorandPoller extends AsyncEventEmitter {
  private pollers = new Map<string, PollerInstance>();
  private nextPollerId = 1;

  constructor(
    private readonly client: AlgorandClient,
    private readonly logger: Logger = Config.logger
  ) {
    super();
  }

  /**
   * Start a new poller with the given configuration
   * @param config - Poller configuration
   * @returns The poller ID
   */
  async start<T>(config: PollerConfig<T>): Promise<string> {
    const id = config.id ?? `poller-${this.nextPollerId++}`;

    if (this.pollers.has(id)) {
      throw new Error(`Poller with id ${id} already exists`);
    }

    const instance = new PollerInstance(
      id,
      config,
      this.client,
      this,
      config.logger ?? this.logger
    );

    this.pollers.set(id, instance);

    await instance.start();

    return id;
  }

  /**
   * Stop a running poller
   * @param pollerId - The ID of the poller to stop
   */
  async stop(pollerId: string): Promise<void> {
    const instance = this.pollers.get(pollerId);
    if (!instance) {
      throw new Error(`Poller ${pollerId} not found`);
    }

    await instance.stop();
    this.pollers.delete(pollerId);
  }

  /**
   * Stop all running pollers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.pollers.keys()).map((id) =>
      this.stop(id)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Get status of a specific poller
   * @param pollerId - The ID of the poller
   * @returns The poller status
   */
  getStatus(pollerId: string): PollerStatus {
    const instance = this.pollers.get(pollerId);
    if (!instance) {
      throw new Error(`Poller ${pollerId} not found`);
    }

    return instance.getStatus();
  }

  /**
   * Get status of all pollers
   * @returns Array of poller statuses
   */
  getAllStatus(): PollerStatus[] {
    return Array.from(this.pollers.values()).map((p) => p.getStatus());
  }

  /**
   * Check if a poller exists and is running
   * @param pollerId - The ID of the poller
   * @returns True if the poller is running
   */
  isRunning(pollerId: string): boolean {
    const instance = this.pollers.get(pollerId);
    return instance?.getStatus().state === PollerState.RUNNING;
  }
}
