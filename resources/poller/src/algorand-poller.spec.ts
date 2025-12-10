import type { AlgodClient } from "@algorandfoundation/algokit-utils/packages/algod_client/src";
import { algoKitLogCaptureFixture } from "@algorandfoundation/algokit-utils/testing";
import { type AlgorandClient } from "@algorandfoundation/algokit-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AlgorandPoller } from "./algorand-poller";
import {
  PollerState,
  type PollerErrorEvent,
  type PollerMatchEvent
} from "./poller-types";

// Test helpers
function createMockAlgorandClient(): AlgorandClient {
  let currentRound = BigInt(1000);

  const mockAlgodClient: Partial<AlgodClient> = {
    async getStatus() {
      return { lastRound: currentRound } as Awaited<
        ReturnType<AlgodClient["getStatus"]>
      >;
    },
    async waitForBlock(round: bigint) {
      // Simulate block progression
      await new Promise((r) => setTimeout(r, 50));
      currentRound = round + BigInt(1);
      return { lastRound: currentRound } as Awaited<
        ReturnType<AlgodClient["waitForBlock"]>
      >;
    }
  };

  return {
    client: {
      algod: mockAlgodClient as AlgodClient
    }
  } as AlgorandClient;
}

async function waitFor(
  condition: () => boolean,
  timeout = 5000
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("Timeout waiting for condition");
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("AlgorandPoller", () => {
  const logging = algoKitLogCaptureFixture();
  let algorand: AlgorandClient;
  let poller: AlgorandPoller;

  beforeEach(() => {
    logging.beforeEach();
    algorand = createMockAlgorandClient();
    poller = new AlgorandPoller(algorand, logging.testLogger);
  });

  afterEach(async () => {
    await poller.stopAll();
    logging.afterEach();
  });

  describe("Initialization and Lifecycle", () => {
    describe("start", () => {
      it("should start a poller with valid config", async () => {
        const mockEndpoint = vi
          .fn()
          .mockResolvedValue({ totalTransactions: 5 });

        const pollerId = await poller.start({
          endpoint: mockEndpoint,
          query: z.object({ totalTransactions: z.number().min(5) }),
          timeout: { type: "rounds", value: 5 }
        });

        expect(pollerId).toBeDefined();
        expect(poller.isRunning(pollerId)).toBe(true);

        await waitFor(() => !poller.isRunning(pollerId));

        expect(mockEndpoint).toHaveBeenCalled();
      });

      it("should throw if poller with same ID already exists", async () => {
        await poller.start({
          id: "test-poller",
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number() }),
          timeout: { type: "rounds", value: 5 }
        });

        await expect(
          poller.start({
            id: "test-poller",
            endpoint: () => Promise.resolve({ value: 1 }),
            query: z.object({ value: z.number() })
          })
        ).rejects.toThrow("Poller with id test-poller already exists");
      });

      it("should throw if trying to start an already running poller instance", async () => {
        const pollerId = await poller.start({
          id: "test-poller",
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 100 }
        });

        expect(poller.isRunning(pollerId)).toBe(true);

        // Try to start the same instance again via internal mechanism
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instance = (poller as any).pollers.get(pollerId);
        await expect(instance.start()).rejects.toThrow(
          `Poller ${pollerId} is already running`
        );

        await poller.stop(pollerId);
      });

      it("should auto-generate IDs if not provided", async () => {
        const id1 = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 2 }
        });

        const id2 = await poller.start({
          endpoint: () => Promise.resolve({ value: 2 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 2 }
        });

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^poller-\d+$/);
        expect(id2).toMatch(/^poller-\d+$/);
      });
    });

    describe("stop", () => {
      it("should stop a specific poller", async () => {
        const stoppedSpy = vi.fn();
        poller.on("poller:stopped", stoppedSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 100 }
        });

        expect(poller.isRunning(pollerId)).toBe(true);

        await poller.stop(pollerId);

        expect(poller.isRunning(pollerId)).toBe(false);
        expect(stoppedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pollerId,
            reason: "manual"
          }),
          "poller:stopped"
        );
      });

      it("should stop all pollers", async () => {
        await poller.start({
          id: "poller-1",
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 100 }
        });

        await poller.start({
          id: "poller-2",
          endpoint: () => Promise.resolve({ value: 2 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 100 }
        });

        expect(poller.isRunning("poller-1")).toBe(true);
        expect(poller.isRunning("poller-2")).toBe(true);

        await poller.stopAll();

        expect(poller.isRunning("poller-1")).toBe(false);
        expect(poller.isRunning("poller-2")).toBe(false);
      });

      it("should throw when trying to stop non-existent poller", async () => {
        await expect(poller.stop("non-existent")).rejects.toThrow(
          "Poller non-existent not found"
        );
      });

      it("should allow manual stop via event handler", async () => {
        const matchSpy = vi.fn();
        const stoppedSpy = vi.fn();

        poller.on("poller:match", async (event: PollerMatchEvent) => {
          matchSpy(event, "poller:match");
          await poller.stop(event.pollerId);
        });
        poller.on("poller:stopped", stoppedSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 5 }),
          query: z.object({ totalTransactions: z.number().min(5) }),
          timeout: { type: "rounds", value: 10 }
        });

        await waitFor(() => !poller.isRunning(pollerId));
        await new Promise((r) => setTimeout(r, 100));

        expect(matchSpy).toHaveBeenCalledOnce();
        expect(stoppedSpy).toHaveBeenCalledWith(
          expect.objectContaining({ pollerId, reason: "manual" }),
          "poller:stopped"
        );
      });
    });

    describe("status reporting", () => {
      it("should return accurate status for poller", async () => {
        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 0 }),
          query: z.object({ totalTransactions: z.number().min(10) }),
          timeout: { type: "rounds", value: 3 }
        });

        await new Promise((r) => setTimeout(r, 100));

        const status = poller.getStatus(pollerId);

        expect(status).toMatchObject({
          id: pollerId,
          state: PollerState.RUNNING,
          pollCount: expect.any(Number),
          matchCount: 0,
          errorCount: 0
        });

        await waitFor(() => !poller.isRunning(pollerId));
      });

      it("should return all statuses", async () => {
        await poller.start({
          id: "poller-1",
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 3 }
        });

        await poller.start({
          id: "poller-2",
          endpoint: () => Promise.resolve({ value: 2 }),
          query: z.object({ value: z.number().min(10) }),
          timeout: { type: "rounds", value: 3 }
        });

        const statuses = poller.getAllStatus();
        expect(statuses).toHaveLength(2);
        expect(statuses[0].id).toBe("poller-1");
        expect(statuses[1].id).toBe("poller-2");

        await poller.stopAll();
      });

      it("should throw when trying to get status of non-existent poller", () => {
        expect(() => poller.getStatus("non-existent")).toThrow(
          "Poller non-existent not found"
        );
      });
    });

    describe("event emission", () => {
      it("should emit started event", async () => {
        const startedSpy = vi.fn();
        poller.on("poller:started", startedSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number() }),
          timeout: { type: "rounds", value: 2 }
        });

        expect(startedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pollerId,
            startRound: expect.any(BigInt)
          }),
          "poller:started"
        );

        await waitFor(() => !poller.isRunning(pollerId));
      });

      it("should emit poll events for debugging", async () => {
        const pollSpy = vi.fn();
        poller.on("poller:poll", pollSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number() }),
          timeout: { type: "rounds", value: 3 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(pollSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(pollSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pollerId,
            round: expect.any(BigInt),
            response: expect.any(Object),
            matched: expect.any(Boolean),
            validation: expect.any(Object)
          }),
          "poller:poll"
        );
      });
    });

    describe("concurrent pollers", () => {
      it("should manage multiple pollers independently", async () => {
        const poller1Match = vi.fn();
        const poller2Match = vi.fn();

        poller.on("poller:match", (event: PollerMatchEvent) => {
          if (event.pollerId === "poller-1") poller1Match();
          if (event.pollerId === "poller-2") poller2Match();
        });

        await poller.start({
          id: "poller-1",
          endpoint: () => Promise.resolve({ totalTransactions: 5 }),
          query: z.object({ totalTransactions: z.number().min(5) }),
          timeout: { type: "rounds", value: 10 }
        });

        await poller.start({
          id: "poller-2",
          endpoint: () => Promise.resolve({ amount: 1000 }),
          query: z.object({ amount: z.number().min(1000) }),
          timeout: { type: "rounds", value: 10 }
        });

        await waitFor(() => !poller.isRunning("poller-1"));
        await waitFor(() => !poller.isRunning("poller-2"));

        expect(poller1Match).toHaveBeenCalled();
        expect(poller2Match).toHaveBeenCalled();
      });
    });
  });

  describe("Round-based Polling", () => {
    describe("matching and validation", () => {
      it("should emit match events when query validates successfully", async () => {
        const matchSpy = vi.fn();

        poller.on("poller:match", matchSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 5 }),
          query: z.object({ totalTransactions: z.number().min(5) }),
          timeout: { type: "rounds", value: 3 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        // Should have matched multiple times (polling continues on match)
        expect(matchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      it("should not match when query fails validation", async () => {
        const matchSpy = vi.fn();
        const timeoutSpy = vi.fn();

        poller.on("poller:match", matchSpy);
        poller.on("poller:timeout", timeoutSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 0 }),
          query: z.object({ totalTransactions: z.number().min(5) }),
          timeout: { type: "rounds", value: 3 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(matchSpy).not.toHaveBeenCalled();
        expect(timeoutSpy).toHaveBeenCalledOnce();
      });
    });

    describe("timeout handling", () => {
      it("should timeout after specified rounds", async () => {
        const timeoutSpy = vi.fn();

        poller.on("poller:timeout", timeoutSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 0 }),
          query: z.object({ totalTransactions: z.number().min(10) }),
          timeout: { type: "rounds", value: 3 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(timeoutSpy).toHaveBeenCalledOnce();
        expect(timeoutSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pollerId,
            timeout: { type: "rounds", value: 3 }
          }),
          "poller:timeout"
        );
      });

      it("should timeout after specified time", async () => {
        const timeoutSpy = vi.fn();

        poller.on("poller:timeout", timeoutSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 0 }),
          query: z.object({ totalTransactions: z.number().min(10) }),
          timeout: { type: "time", value: 200 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(timeoutSpy).toHaveBeenCalledOnce();
      });

      it("should not timeout with type none", async () => {
        const timeoutSpy = vi.fn();
        const matchSpy = vi.fn();
        let matchCount = 0;

        poller.on("poller:timeout", timeoutSpy);
        poller.on("poller:match", async (event: PollerMatchEvent) => {
          matchSpy(event, "poller:match");
          matchCount++;
          if (matchCount >= 3) {
            await poller.stop(event.pollerId);
          }
        });

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ totalTransactions: 10 }),
          query: z.object({ totalTransactions: z.number().min(10) }),
          timeout: { type: "none" }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(timeoutSpy).not.toHaveBeenCalled();
        expect(matchSpy).toHaveBeenCalled();
        expect(matchCount).toBeGreaterThanOrEqual(3);
      });
    });

    describe("error handling", () => {
      it("should emit error events and continue polling", async () => {
        const errorSpy = vi.fn();

        poller.on("poller:error", errorSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.reject(new Error("Network error")),
          query: z.any(),
          timeout: { type: "rounds", value: 5 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(errorSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pollerId,
            error: expect.any(Error)
          }),
          "poller:error"
        );
      });

      it("should handle fatal errors in polling loop", async () => {
        const mockAlgorandWithFatalError = {
          client: {
            algod: {
              async getStatus() {
                return { lastRound: BigInt(1000) };
              },
              async waitForBlock() {
                throw new Error("Fatal network error");
              }
            }
          }
        } as unknown as AlgorandClient;

        const fatalPoller = new AlgorandPoller(
          mockAlgorandWithFatalError,
          logging.testLogger
        );

        const pollerId = await fatalPoller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number() }),
          timeout: { type: "rounds", value: 10 }
        });

        await waitFor(() => {
          const status = fatalPoller.getStatus(pollerId);
          return (
            status.state === PollerState.ERROR ||
            status.state === PollerState.STOPPED
          );
        });

        const status = fatalPoller.getStatus(pollerId);
        expect([PollerState.ERROR, PollerState.STOPPED]).toContain(
          status.state
        );

        await fatalPoller.stopAll();
      });

      it("should allow user to stop poller on error via event handler", async () => {
        const errorSpy = vi.fn();
        let attemptCount = 0;

        poller.on("poller:error", async (event: PollerErrorEvent) => {
          errorSpy(event);
          await poller.stop(event.pollerId);
        });

        const pollerId = await poller.start({
          endpoint: () => {
            attemptCount++;
            return Promise.reject(new Error("Network error"));
          },
          query: z.any(),
          timeout: { type: "rounds", value: 10 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(attemptCount).toBe(1);
        expect(errorSpy).toHaveBeenCalledOnce();
      });

      it("should recover from errors and continue polling", async () => {
        const errorSpy = vi.fn();
        const matchSpy = vi.fn();
        let attemptCount = 0;

        poller.on("poller:error", errorSpy);
        poller.on("poller:match", async (event: PollerMatchEvent) => {
          matchSpy(event, "poller:match");
          await poller.stop(event.pollerId);
        });

        const pollerId = await poller.start({
          endpoint: () => {
            attemptCount++;
            if (attemptCount < 3) {
              return Promise.reject(new Error("Network error"));
            }
            return Promise.resolve({ totalTransactions: 5 });
          },
          query: z.object({ totalTransactions: z.number().min(5) }),
          timeout: { type: "rounds", value: 10 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(errorSpy).toHaveBeenCalledTimes(2);
        expect(matchSpy).toHaveBeenCalledOnce();
        expect(attemptCount).toBeGreaterThanOrEqual(3);
      });
    });

    describe("minPollInterval", () => {
      it("should throttle polling with minPollInterval", async () => {
        const timestamps: number[] = [];

        const pollerId = await poller.start({
          endpoint: () => {
            timestamps.push(Date.now());
            return Promise.resolve({ value: 1 });
          },
          query: z.object({ value: z.number().min(10) }),
          minPollInterval: 100,
          timeout: { type: "rounds", value: 3 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        for (let i = 1; i < timestamps.length; i++) {
          const interval = timestamps[i] - timestamps[i - 1];
          expect(interval).toBeGreaterThanOrEqual(80);
        }
      });
    });

    describe("status fields", () => {
      it("should not have nextPollTime in round-based mode", async () => {
        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          pollStrategy: { type: "round" },
          timeout: { type: "rounds", value: 3 }
        });

        await new Promise((r) => setTimeout(r, 100));

        const status = poller.getStatus(pollerId);

        expect(status.nextPollTime).toBeUndefined();

        await waitFor(() => !poller.isRunning(pollerId));
      });
    });
  });

  describe("Interval-based Polling", () => {
    describe("basic functionality", () => {
      it("should poll at fixed intervals regardless of blockchain rounds", async () => {
        const timestamps: number[] = [];
        const mockEndpoint = vi.fn().mockImplementation(() => {
          timestamps.push(Date.now());
          return Promise.resolve({ value: 1 });
        });

        const pollerId = await poller.start({
          endpoint: mockEndpoint,
          query: z.object({ value: z.number().min(10) }),
          pollStrategy: { type: "interval", intervalMs: 150 },
          timeout: { type: "time", value: 500 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(mockEndpoint.mock.calls.length).toBeGreaterThanOrEqual(2);

        for (let i = 1; i < timestamps.length; i++) {
          const interval = timestamps[i] - timestamps[i - 1];
          expect(interval).toBeGreaterThanOrEqual(130);
          expect(interval).toBeLessThanOrEqual(200);
        }
      });

      it("should track currentRound in interval mode", async () => {
        const pollSpy = vi.fn();

        poller.on("poller:poll", pollSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          pollStrategy: { type: "interval", intervalMs: 100 },
          timeout: { type: "time", value: 300 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(pollSpy).toHaveBeenCalled();
        const pollEvents = pollSpy.mock.calls.map((call) => call[0]);

        pollEvents.forEach((event) => {
          expect(event.round).toBeDefined();
        });
      });
    });

    describe("matching and validation", () => {
      it("should support matches in interval mode", async () => {
        const matchSpy = vi.fn();
        let callCount = 0;

        poller.on("poller:match", matchSpy);

        const pollerId = await poller.start({
          endpoint: () => {
            callCount++;
            return Promise.resolve({ value: callCount >= 2 ? 20 : 5 });
          },
          query: z.object({ value: z.number().min(10) }),
          pollStrategy: { type: "interval", intervalMs: 100 },
          timeout: { type: "time", value: 500 }
        });

        await waitFor(() => matchSpy.mock.calls.length > 0);
        await poller.stop(pollerId);

        expect(matchSpy).toHaveBeenCalled();
      });

      it("should support early stop in interval mode", async () => {
        const matchSpy = vi.fn();

        poller.on("poller:match", async (event: PollerMatchEvent) => {
          matchSpy();
          await poller.stop(event.pollerId);
        });

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 20 }),
          query: z.object({ value: z.number().min(10) }),
          pollStrategy: { type: "interval", intervalMs: 100 },
          timeout: { type: "none" }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(matchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe("error handling", () => {
      it("should handle errors in interval mode", async () => {
        const errorSpy = vi.fn();

        poller.on("poller:error", errorSpy);

        const pollerId = await poller.start({
          endpoint: () => Promise.reject(new Error("Test error")),
          query: z.any(),
          pollStrategy: { type: "interval", intervalMs: 100 },
          timeout: { type: "time", value: 350 }
        });

        await waitFor(() => !poller.isRunning(pollerId));

        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0].error.message).toBe("Test error");
      });
    });

    describe("configuration validation", () => {
      it("should warn when using round timeout with interval strategy", async () => {
        const warnSpy = vi.spyOn(logging.testLogger, "warn");

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number() }),
          pollStrategy: { type: "interval", intervalMs: 100 },
          timeout: { type: "rounds", value: 10 }
        });

        expect(poller.isRunning(pollerId)).toBe(true);

        await poller.stop(pollerId);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Use time-based timeout with interval poll strategy"
          )
        );
      });

      it("should warn when minPollInterval is set with interval strategy", async () => {
        const warnSpy = vi.spyOn(logging.testLogger, "warn");

        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number() }),
          pollStrategy: { type: "interval", intervalMs: 100 },
          minPollInterval: 50,
          timeout: { type: "time", value: 200 }
        });

        expect(poller.isRunning(pollerId)).toBe(true);

        await poller.stop(pollerId);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "minPollInterval only applies to round-based polling"
          )
        );
      });

      it("should throw error for invalid intervalMs", async () => {
        await expect(
          poller.start({
            endpoint: () => Promise.resolve({ value: 1 }),
            query: z.object({ value: z.number() }),
            pollStrategy: { type: "interval", intervalMs: 0 }
          })
        ).rejects.toThrow("pollStrategy.intervalMs must be positive");

        await expect(
          poller.start({
            endpoint: () => Promise.resolve({ value: 1 }),
            query: z.object({ value: z.number() }),
            pollStrategy: { type: "interval", intervalMs: -100 }
          })
        ).rejects.toThrow("pollStrategy.intervalMs must be positive");
      });
    });

    describe("status fields", () => {
      it("should include nextPollTime in status for interval mode", async () => {
        const pollerId = await poller.start({
          endpoint: () => Promise.resolve({ value: 1 }),
          query: z.object({ value: z.number().min(10) }),
          pollStrategy: { type: "interval", intervalMs: 1000 },
          timeout: { type: "time", value: 5000 }
        });

        await new Promise((r) => setTimeout(r, 150));

        const status = poller.getStatus(pollerId);

        expect(status.nextPollTime).toBeDefined();
        expect(status.nextPollTime).toBeInstanceOf(Date);

        await poller.stop(pollerId);
      });
    });
  });
});
