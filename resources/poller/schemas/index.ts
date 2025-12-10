/**
 * Reusable validators and Zod schemas for use with AlgorandPoller.
 *
 * ## Organization
 *
 * This module is organized into two main categories:
 *
 * ### `schemas/transactions`
 * Transaction-level validators that work with SignedTransaction objects.
 * These are pure predicates that can be used with any array of signed transactions.
 *
 * ### `schemas/algod`
 * Algod endpoint-specific Zod schemas that combine base endpoint responses
 * with transaction validators. Use these directly with AlgorandPoller.
 *
 * @example Basic Usage
 * ```typescript
 * import { pendingPaymentWithNoteSchema } from '@algorandfoundation/algokit-utils/poller/schemas'
 * import { AlgorandPoller } from '@algorandfoundation/algokit-utils/poller'
 *
 * const poller = new AlgorandPoller(algorand)
 * await poller.start({
 *   endpoint: (algorand) => algorand.client.algod.getPendingTransactions({ max: 1000 }),
 *   query: pendingPaymentWithNoteSchema,
 *   timeout: { type: 'rounds', value: 100 },
 * })
 * ```
 *
 * @example Using Transaction Validators Directly
 * ```typescript
 * import { isPaymentWithNote } from '@algorandfoundation/algokit-utils/poller/schemas/transactions'
 *
 * // Filter an array of signed transactions
 * const matchingTxs = signedTransactions.filter(isPaymentWithNote)
 * ```
 *
 * @example Creating Custom Schemas
 * ```typescript
 * import { basePendingTransactionsSchema } from '@algorandfoundation/algokit-utils/poller/schemas'
 * import { isPaymentWithNote, isPaymentWithMinAmount } from '@algorandfoundation/algokit-utils/poller/schemas/transactions'
 *
 * // Combine multiple transaction validators
 * const customSchema = basePendingTransactionsSchema.refine(
 *   (data) => {
 *     const pendingTxs = data as GetPendingTransactions
 *     if (pendingTxs.totalTransactions === 0) return false
 *     return pendingTxs.topTransactions.some(tx =>
 *       isPaymentWithNote(tx) && isPaymentWithMinAmount(1_000_000n)(tx)
 *     )
 *   },
 *   { message: 'Waiting for payment with note and minimum 1 ALGO' }
 * )
 * ```
 */

// Re-export algod schemas for convenience (most common use case)
export * from "./algod";

// Transaction validators are available via subpath import
// import { ... } from '@algorandfoundation/algokit-utils/poller/schemas/transactions'
