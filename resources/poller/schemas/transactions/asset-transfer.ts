import type { AssetTransferTransactionFields } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/asset-transfer";
import type { SignedTransaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import type { Transaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/transaction";
import { z } from "zod";
import { logicSignatureSchema, multisigSignatureSchema } from "./common";

/**
 * Transaction-level validators for asset transfer transactions.
 * These can be used with any array of SignedTransactions, not just pending transactions.
 *
 * All validators use Zod for runtime validation to ensure type safety.
 */

/**
 * Zod schema for asset transfer transaction fields.
 * Corresponds to {@link AssetTransferTransactionFields} from @algorandfoundation/algokit-transact
 */
const assetTransferFieldsSchema: z.ZodType<AssetTransferTransactionFields> =
  z.object({
    assetId: z.bigint(),
    amount: z.bigint(),
    receiver: z.string(),
    assetSender: z.string().optional(),
    closeRemainderTo: z.string().optional()
  });

/**
 * An asset transfer transaction is a {@link Transaction} with type='axfer' and an assetTransfer field.
 * It has all the common transaction attributes (sender, firstValid, lastValid, fee, note, etc.).
 */
export type AssetTransferTransaction = Omit<
  Transaction,
  "type" | "assetTransfer"
> & {
  type: "axfer";
  assetTransfer: AssetTransferTransactionFields;
};

/**
 * Zod schema for validating asset transfer transactions.
 * Validates all Transaction fields plus the assetTransfer-specific field.
 */
const assetTransferTransactionSchema: z.ZodType<AssetTransferTransaction> =
  z.object({
    // Transaction type
    type: z.literal("axfer"),

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

    // Asset transfer-specific field
    assetTransfer: assetTransferFieldsSchema,

    // Other transaction type fields (should be undefined for asset transfer transactions)
    payment: z.undefined(),
    assetConfig: z.undefined(),
    appCall: z.undefined(),
    keyRegistration: z.undefined(),
    assetFreeze: z.undefined(),
    heartbeat: z.undefined(),
    stateProof: z.undefined()
  });

/**
 * A signed asset transfer transaction type
 */
export type SignedAssetTransferTransaction = Omit<SignedTransaction, "txn"> & {
  txn: AssetTransferTransaction;
};

/**
 * Zod schema for validating signed asset transfer transactions.
 * Validates all SignedTransaction fields with the txn field containing an asset transfer transaction.
 */
const signedAssetTransferTransactionSchema: z.ZodType<SignedAssetTransferTransaction> =
  z.object({
    txn: assetTransferTransactionSchema,
    signature: z.instanceof(Uint8Array).optional(),
    multiSignature: multisigSignatureSchema.optional(),
    logicSignature: logicSignatureSchema.optional(),
    authAddress: z.string().optional()
  });

/**
 * Helper to safely validate and extract asset transfer transaction data.
 * Returns the parsed data if valid, null otherwise.
 */
function parseAssetTransferTransaction(signedTx: SignedTransaction) {
  const result = signedAssetTransferTransactionSchema.safeParse(signedTx);
  return result.success ? result.data : null;
}

/**
 * Checks if a signed transaction is an asset transfer transaction.
 * Uses Zod validation to ensure type safety at runtime.
 */
export function isAssetTransferTransaction(
  signedTx: SignedTransaction
): boolean {
  return parseAssetTransferTransaction(signedTx) !== null;
}

/**
 * Checks if a signed transaction is an asset transfer to a specific receiver.
 */
export function isAssetTransferToReceiver(receiverAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetTransferTransaction(signedTx);
    return (
      parsed !== null && parsed.txn.assetTransfer.receiver === receiverAddress
    );
  };
}

/**
 * Checks if a signed transaction is an asset transfer from a specific sender.
 */
export function isAssetTransferFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetTransferTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === senderAddress;
  };
}

/**
 * Checks if a signed transaction is a transfer of a specific asset.
 */
export function isAssetTransferOfAsset(assetId: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetTransferTransaction(signedTx);
    return parsed !== null && parsed.txn.assetTransfer.assetId === assetId;
  };
}

/**
 * Checks if a signed transaction is an asset transfer with at least the specified amount.
 */
export function isAssetTransferWithMinAmount(minAmount: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetTransferTransaction(signedTx);
    return parsed !== null && parsed.txn.assetTransfer.amount >= minAmount;
  };
}

/**
 * Checks if a signed transaction is a transfer of a specific asset to a specific receiver.
 * This is useful for tracking specific asset payments to an address.
 */
export function isAssetTransferOfAssetToReceiver(
  assetId: bigint,
  receiverAddress: string
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetTransferTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.assetTransfer.assetId === assetId &&
      parsed.txn.assetTransfer.receiver === receiverAddress
    );
  };
}

/**
 * Checks if a signed transaction is an asset transfer with close-out.
 * This indicates the sender is closing out their position in the asset.
 */
export function isAssetTransferWithCloseOut(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAssetTransferTransaction(signedTx);
  return (
    parsed !== null && parsed.txn.assetTransfer.closeRemainderTo !== undefined
  );
}

/**
 * Checks if a signed transaction is an asset clawback operation.
 * A clawback is when the asset clawback address forcibly moves assets from one account to another.
 */
export function isAssetClawback(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetTransferTransaction(signedTx);
  return parsed !== null && parsed.txn.assetTransfer.assetSender !== undefined;
}
