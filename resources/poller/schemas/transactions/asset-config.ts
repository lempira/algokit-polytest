import type { AssetConfigTransactionFields } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/asset-config";
import type { SignedTransaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import type { Transaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/transaction";
import { z } from "zod";
import { logicSignatureSchema, multisigSignatureSchema } from "./common";

/**
 * Transaction-level validators for asset configuration transactions.
 * These can be used with any array of SignedTransactions, not just pending transactions.
 *
 * All validators use Zod for runtime validation to ensure type safety.
 */

/**
 * Zod schema for asset configuration transaction fields.
 * Corresponds to {@link AssetConfigTransactionFields} from @algorandfoundation/algokit-transact
 */
const assetConfigFieldsSchema: z.ZodType<AssetConfigTransactionFields> =
  z.object({
    assetId: z.bigint(),
    total: z.bigint().optional(),
    decimals: z.number().optional(),
    defaultFrozen: z.boolean().optional(),
    assetName: z.string().optional(),
    unitName: z.string().optional(),
    url: z.string().optional(),
    metadataHash: z.instanceof(Uint8Array).optional(),
    manager: z.string().optional(),
    reserve: z.string().optional(),
    freeze: z.string().optional(),
    clawback: z.string().optional()
  });

/**
 * An asset config transaction is a {@link Transaction} with type='acfg' and an assetConfig field.
 * It has all the common transaction attributes (sender, firstValid, lastValid, fee, note, etc.).
 */
export type AssetConfigTransaction = Omit<
  Transaction,
  "type" | "assetConfig"
> & {
  type: "acfg";
  assetConfig: AssetConfigTransactionFields;
};

/**
 * Zod schema for validating asset config transactions.
 * Validates all Transaction fields plus the assetConfig-specific field.
 */
const assetConfigTransactionSchema: z.ZodType<AssetConfigTransaction> =
  z.object({
    // Transaction type
    type: z.literal("acfg"),

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

    // Asset config-specific field
    assetConfig: assetConfigFieldsSchema,

    // Other transaction type fields (should be undefined for asset config transactions)
    payment: z.undefined(),
    assetTransfer: z.undefined(),
    appCall: z.undefined(),
    keyRegistration: z.undefined(),
    assetFreeze: z.undefined(),
    heartbeat: z.undefined(),
    stateProof: z.undefined()
  });

/**
 * A signed asset config transaction type
 */
export type SignedAssetConfigTransaction = Omit<SignedTransaction, "txn"> & {
  txn: AssetConfigTransaction;
};

/**
 * Zod schema for validating signed asset config transactions.
 * Validates all SignedTransaction fields with the txn field containing an asset config transaction.
 */
const signedAssetConfigTransactionSchema: z.ZodType<SignedAssetConfigTransaction> =
  z.object({
    txn: assetConfigTransactionSchema,
    signature: z.instanceof(Uint8Array).optional(),
    multiSignature: multisigSignatureSchema.optional(),
    logicSignature: logicSignatureSchema.optional(),
    authAddress: z.string().optional()
  });

/**
 * Helper to safely validate and extract asset config transaction data.
 * Returns the parsed data if valid, null otherwise.
 */
function parseAssetConfigTransaction(signedTx: SignedTransaction) {
  const result = signedAssetConfigTransactionSchema.safeParse(signedTx);
  return result.success ? result.data : null;
}

/**
 * Checks if a signed transaction is an asset config transaction.
 * Uses Zod validation to ensure type safety at runtime.
 */
export function isAssetConfigTransaction(signedTx: SignedTransaction): boolean {
  return parseAssetConfigTransaction(signedTx) !== null;
}

/**
 * Checks if a signed transaction is an asset creation.
 * Asset creation is indicated by assetId === 0n.
 */
export function isAssetCreation(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return parsed !== null && parsed.txn.assetConfig.assetId === 0n;
}

/**
 * Checks if a signed transaction is an asset reconfiguration.
 * Reconfiguration is when assetId !== 0n and mutable parameters are being set.
 */
export function isAssetReconfiguration(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  if (parsed === null || parsed.txn.assetConfig.assetId === 0n) return false;

  // Check if any mutable parameters are set
  const config = parsed.txn.assetConfig;
  return (
    config.manager !== undefined ||
    config.reserve !== undefined ||
    config.freeze !== undefined ||
    config.clawback !== undefined
  );
}

/**
 * Checks if a signed transaction is an asset destroy operation.
 * Destroy is when assetId !== 0n and all parameters are undefined or empty.
 */
export function isAssetDestroy(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  if (parsed === null || parsed.txn.assetConfig.assetId === 0n) return false;

  const config = parsed.txn.assetConfig;
  return (
    config.manager === undefined &&
    config.reserve === undefined &&
    config.freeze === undefined &&
    config.clawback === undefined &&
    config.total === undefined &&
    config.decimals === undefined &&
    config.defaultFrozen === undefined &&
    config.assetName === undefined &&
    config.unitName === undefined &&
    config.url === undefined &&
    config.metadataHash === undefined
  );
}

/**
 * Checks if a signed transaction is an asset config from a specific sender.
 */
export function isAssetConfigFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === senderAddress;
  };
}

/**
 * Checks if a signed transaction is a config operation for a specific asset.
 * Note: This will not match asset creation (assetId === 0n).
 */
export function isAssetConfigOfAsset(assetId: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return parsed !== null && parsed.txn.assetConfig.assetId === assetId;
  };
}

/**
 * Checks if a signed transaction is an asset creation with a specific asset name.
 */
export function isAssetCreationWithName(assetName: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.assetConfig.assetId === 0n &&
      parsed.txn.assetConfig.assetName === assetName
    );
  };
}

/**
 * Checks if a signed transaction is an asset creation with a specific unit name.
 */
export function isAssetCreationWithUnitName(unitName: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.assetConfig.assetId === 0n &&
      parsed.txn.assetConfig.unitName === unitName
    );
  };
}

/**
 * Checks if a signed transaction is an asset config sent by a specific manager address.
 * This assumes the sender is the manager (the only account authorized to reconfigure).
 */
export function isAssetConfigByManager(managerAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === managerAddress;
  };
}

/**
 * Checks if a signed transaction is setting a specific manager address.
 */
export function isAssetConfigSettingManager(managerAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return parsed !== null && parsed.txn.assetConfig.manager === managerAddress;
  };
}

/**
 * Checks if a signed transaction is setting a specific reserve address.
 */
export function isAssetConfigSettingReserve(reserveAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return parsed !== null && parsed.txn.assetConfig.reserve === reserveAddress;
  };
}

/**
 * Checks if a signed transaction is setting a specific freeze address.
 */
export function isAssetConfigSettingFreeze(freezeAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return parsed !== null && parsed.txn.assetConfig.freeze === freezeAddress;
  };
}

/**
 * Checks if a signed transaction is setting a specific clawback address.
 */
export function isAssetConfigSettingClawback(clawbackAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAssetConfigTransaction(signedTx);
    return (
      parsed !== null && parsed.txn.assetConfig.clawback === clawbackAddress
    );
  };
}

/**
 * Checks if a signed transaction is an asset config with a manager address set.
 */
export function isAssetConfigWithManager(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.manager !== undefined &&
    parsed.txn.assetConfig.manager !== ""
  );
}

/**
 * Checks if a signed transaction is an asset config with a reserve address set.
 */
export function isAssetConfigWithReserve(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.reserve !== undefined &&
    parsed.txn.assetConfig.reserve !== ""
  );
}

/**
 * Checks if a signed transaction is an asset config with a freeze address set.
 */
export function isAssetConfigWithFreeze(signedTx: SignedTransaction): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.freeze !== undefined &&
    parsed.txn.assetConfig.freeze !== ""
  );
}

/**
 * Checks if a signed transaction is an asset config with a clawback address set.
 */
export function isAssetConfigWithClawback(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.clawback !== undefined &&
    parsed.txn.assetConfig.clawback !== ""
  );
}

/**
 * Checks if a signed transaction is removing the manager address (setting to empty/zero address).
 * This makes the asset permanently immutable.
 */
export function isAssetConfigRemovingManager(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.manager !== undefined &&
    (parsed.txn.assetConfig.manager === "" ||
      parsed.txn.assetConfig.manager ===
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ")
  );
}

/**
 * Checks if a signed transaction is removing the freeze address (setting to empty/zero address).
 * This permanently disables freezing for the asset.
 */
export function isAssetConfigRemovingFreeze(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.freeze !== undefined &&
    (parsed.txn.assetConfig.freeze === "" ||
      parsed.txn.assetConfig.freeze ===
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ")
  );
}

/**
 * Checks if a signed transaction is removing the clawback address (setting to empty/zero address).
 * This permanently disables clawback for the asset.
 */
export function isAssetConfigRemovingClawback(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAssetConfigTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.assetConfig.clawback !== undefined &&
    (parsed.txn.assetConfig.clawback === "" ||
      parsed.txn.assetConfig.clawback ===
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ")
  );
}
