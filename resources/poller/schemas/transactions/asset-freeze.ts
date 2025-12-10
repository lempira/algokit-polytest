import type { AssetFreezeTransactionFields } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/asset-freeze";
import type { SignedTransaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import type { Transaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/transaction";
import { z } from "zod";
import { logicSignatureSchema, multisigSignatureSchema } from "./common";

/**
 * Transaction-level validators for asset freeze transactions.
 * These can be used with any array of SignedTransactions, not just pending transactions.
 *
 * All validators use Zod for runtime validation to ensure type safety.
 */

/**
 * Zod schema for asset freeze transaction fields.
 * Corresponds to {@link AssetFreezeTransactionFields} from @algorandfoundation/algokit-transact
 */
const assetFreezeFieldsSchema: z.ZodType<AssetFreezeTransactionFields> =
  z.object({
    assetId: z.bigint(),
    freezeTarget: z.string(),
    frozen: z.boolean()
  });

/**
 * An asset freeze transaction is a {@link Transaction} with type='afrz' and an assetFreeze field.
 * It has all the common transaction attributes (sender, firstValid, lastValid, fee, note, etc.).
 */
export type AssetFreezeTransaction = Omit<
  Transaction,
  "type" | "assetFreeze"
> & {
  type: "afrz";
  assetFreeze: AssetFreezeTransactionFields;
};

/**
 * Zod schema for validating asset freeze transactions.
 * Validates all Transaction fields plus the assetFreeze-specific field.
 */
const assetFreezeTransactionSchema: z.ZodType<AssetFreezeTransaction> =
  z.object({
    // Transaction type
    type: z.literal("afrz"),

    // Required Transaction fields
    sender: z.string(),
    firstValid: z.bigint(),
    lastValid: z.bigint(),

    // Optional Transaction fields
    fee: z.bigint().optional(),
    genesisHash: z.instanceof(Uint8Array).optional(),
    genesisId: z.string().optional(),
    note: z.instanceof(Uint8Array).optional(),
    rekeyTo: z.string().optional(),
    lease: z.instanceof(Uint8Array).optional(),
    group: z.instanceof(Uint8Array).optional(),

    // Asset freeze-specific field
    assetFreeze: assetFreezeFieldsSchema,

    // Other transaction type fields (should be undefined for asset freeze transactions)
    payment: z.undefined(),
    assetTransfer: z.undefined(),
    assetConfig: z.undefined(),
    appCall: z.undefined(),
    keyRegistration: z.undefined(),
    heartbeat: z.undefined(),
    stateProof: z.undefined()
  });

/**
 * A signed asset freeze transaction type
 */
export type SignedAssetFreezeTransaction = Omit<SignedTransaction, "txn"> & {
  txn: AssetFreezeTransaction;
};

/**
 * Zod schema for validating signed asset freeze transactions.
 * Validates all SignedTransaction fields with the txn field containing an asset freeze transaction.
 */
const signedAssetFreezeTransactionSchema: z.ZodType<SignedAssetFreezeTransaction> =
  z.object({
    txn: assetFreezeTransactionSchema,
    signature: z.instanceof(Uint8Array).optional(),
    multiSignature: multisigSignatureSchema.optional(),
    logicSignature: logicSignatureSchema.optional(),
    authAddress: z.string().optional()
  });

/**
 * Helper to safely validate and extract asset freeze transaction data.
 * Returns the parsed data if valid, null otherwise.
 */
function parseAssetFreezeTransaction(signedTx: SignedTransaction) {
  const result = signedAssetFreezeTransactionSchema.safeParse(signedTx);
  return result.success ? result.data : null;
}

/**
 * Checks if a signed transaction is an asset freeze transaction.
 * Uses Zod validation to ensure type safety at runtime.
 */
export function isAssetFreezeTransaction(signedTx: SignedTransaction): boolean {
  return parseAssetFreezeTransaction(signedTx) !== null;
}

/**
 * Checks if a signed transaction is an asset freeze operation (frozen=true).
 * This prevents the target account from transferring the asset.
 */
export function isAssetFreeze(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetFreezeTransaction(signedTx);
  return parsed !== null && parsed.txn.assetFreeze.frozen === true;
}

/**
 * Checks if a signed transaction is an asset unfreeze operation (frozen=false).
 * This allows the target account to transfer the asset again.
 */
export function isAssetUnfreeze(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetFreezeTransaction(signedTx);
  return parsed !== null && parsed.txn.assetFreeze.frozen === false;
}

/**
 * Checks if a signed transaction is an asset freeze from a specific sender.
 * The sender must be the freeze address for the asset.
 */
export function isAssetFreezeFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetFreezeTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === senderAddress;
  };
}

/**
 * Checks if a signed transaction is a freeze operation for a specific asset.
 */
export function isAssetFreezeOfAsset(assetId: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetFreezeTransaction(signedTx);
    return parsed !== null && parsed.txn.assetFreeze.assetId === assetId;
  };
}

/**
 * Checks if a signed transaction is an asset freeze targeting a specific account.
 */
export function isAssetFreezeTargeting(targetAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetFreezeTransaction(signedTx);
    return (
      parsed !== null && parsed.txn.assetFreeze.freezeTarget === targetAddress
    );
  };
}

/**
 * Checks if a signed transaction is a freeze operation for a specific asset targeting a specific account.
 * This is useful for tracking freeze operations on specific asset holdings.
 */
export function isAssetFreezeOfAssetTargeting(
  assetId: bigint,
  targetAddress: string
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetFreezeTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.assetFreeze.assetId === assetId &&
      parsed.txn.assetFreeze.freezeTarget === targetAddress
    );
  };
}

/**
 * Checks if a signed transaction is a freeze operation for a specific asset targeting a specific account with a specific status.
 * This is useful when you want to match a specific freeze or unfreeze action.
 */
export function isAssetFreezeOfAssetTargetingWithStatus(
  assetId: bigint,
  targetAddress: string,
  frozen: boolean
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetFreezeTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.assetFreeze.assetId === assetId &&
      parsed.txn.assetFreeze.freezeTarget === targetAddress &&
      parsed.txn.assetFreeze.frozen === frozen
    );
  };
}

/**
 * Checks if a signed transaction is an asset freeze from a specific sender for a specific asset.
 * This is useful for tracking freeze operations by a specific freeze authority on a specific asset.
 */
export function isAssetFreezeFromSenderOfAsset(
  senderAddress: string,
  assetId: bigint
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetFreezeTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.sender === senderAddress &&
      parsed.txn.assetFreeze.assetId === assetId
    );
  };
}
