import { z } from "zod";

/**
 * Result of testing a response against multiple schemas
 */
export interface SchemaMatchResult<T> {
  /**
   * Whether the response matched at least one schema
   */
  matched: boolean;

  /**
   * Names of all schemas that matched
   */
  matchedSchemas: string[];

  /**
   * The original response
   */
  response: T;
}

/**
 * Tests a response against multiple schemas and returns all matches
 *
 * @param response - The response to test
 * @param schemas - Object mapping schema names to Zod schemas
 * @returns Result containing whether any schema matched and which schemas matched
 *
 * @example
 * ```typescript
 * const result = testMultipleSchemas(response, {
 *   anyPendingTransactionsSchema,
 *   pendingPaymentTransactionsSchema,
 *   pendingPaymentWithNoteSchema
 * })
 *
 * if (result.matched) {
 *   console.log(`Matched schemas: ${result.matchedSchemas.join(', ')}`)
 * }
 * ```
 */
export function testMultipleSchemas<T>(
  response: T,
  schemas: Record<string, z.ZodType<T>>
): SchemaMatchResult<T> {
  const matchedSchemas: string[] = [];

  for (const [schemaName, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(response);
    if (result.success) {
      matchedSchemas.push(schemaName);
    }
  }

  return {
    matched: matchedSchemas.length > 0,
    matchedSchemas,
    response
  };
}
