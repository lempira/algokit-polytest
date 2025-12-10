import * as fs from "fs/promises";
import * as path from "path";

/**
 * Record of a matched transaction response
 */
export interface MatchRecord {
  /**
   * ISO 8601 timestamp
   */
  timestamp: string;

  /**
   * Round number as string (BigInt serialization)
   */
  round: string;

  /**
   * Number of polls attempted
   */
  pollCount: number;

  /**
   * Names of schemas that matched
   */
  matchedSchemas: string[];

  /**
   * Full response from endpoint
   */
  response: unknown;
}

/**
 * Handles logging matched transactions to a JSON file
 *
 * Writes a valid JSON array that is always readable, even during polling.
 * Updates the file with each new entry by rewriting the entire array.
 */
export class MatchLogger {
  private outputPath: string;
  private records: MatchRecord[] = [];
  private isInitialized: boolean = false;

  /**
   * Creates a new MatchLogger
   *
   * @param outputPath - Full path to output JSON file
   */
  constructor(outputPath: string) {
    this.outputPath = outputPath;
  }

  /**
   * Initializes the output file with an empty array
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const dir = path.dirname(this.outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Write initial empty array
    await fs.writeFile(this.outputPath, "[]", "utf-8");
    this.isInitialized = true;
  }

  /**
   * Logs a match to the JSON file
   *
   * @param record - Match record to log
   */
  async logMatch(record: MatchRecord): Promise<void> {
    try {
      await this.initialize();

      // Add record to in-memory array
      this.records.push(record);

      // Write entire array to file
      const json = JSON.stringify(this.records, bigIntReplacer, 2);
      await fs.writeFile(this.outputPath, json, "utf-8");
    } catch (error) {
      console.error("Failed to log match to file:", error);
    }
  }
}

/**
 * Custom JSON replacer to handle BigInt values
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
