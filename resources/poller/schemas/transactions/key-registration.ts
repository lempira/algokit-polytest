import type { KeyRegistrationTransactionFields } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/key-registration";
import type { SignedTransaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import type { Transaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/transaction";
import { z } from "zod";
import { logicSignatureSchema, multisigSignatureSchema } from "./common";

/**
 * Transaction-level validators for key registration transactions.
 * These can be used with any array of SignedTransactions, not just pending transactions.
 *
 * All validators use Zod for runtime validation to ensure type safety.
 *
 * Key registration transactions can be:
 * - **Online**: Registers participation keys (voteKey, selectionKey, stateProofKey, vote rounds)
 * - **Offline**: Marks account as non-participating (nonParticipation=true)
 */

/**
 * Zod schema for key registration transaction fields.
 * Corresponds to {@link KeyRegistrationTransactionFields} from @algorandfoundation/algokit-transact
 */
const keyRegistrationFieldsSchema: z.ZodType<KeyRegistrationTransactionFields> =
  z.object({
    voteKey: z.instanceof(Uint8Array).optional(),
    selectionKey: z.instanceof(Uint8Array).optional(),
    stateProofKey: z.instanceof(Uint8Array).optional(),
    voteFirst: z.bigint().optional(),
    voteLast: z.bigint().optional(),
    voteKeyDilution: z.bigint().optional(),
    nonParticipation: z.boolean().optional()
  });

/**
 * A key registration transaction is a {@link Transaction} with type='keyreg' and a keyRegistration field.
 * It has all the common transaction attributes (sender, firstValid, lastValid, fee, note, etc.).
 */
export type KeyRegistrationTransaction = Omit<
  Transaction,
  "type" | "keyRegistration"
> & {
  type: "keyreg";
  keyRegistration: KeyRegistrationTransactionFields;
};

/**
 * Zod schema for validating key registration transactions.
 * Validates all Transaction fields plus the keyRegistration-specific field.
 */
const keyRegistrationTransactionSchema: z.ZodType<KeyRegistrationTransaction> =
  z.object({
    // Transaction type
    type: z.literal("keyreg"),

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

    // Key registration-specific field
    keyRegistration: keyRegistrationFieldsSchema,

    // Other transaction type fields (should be undefined for key registration transactions)
    payment: z.undefined(),
    assetTransfer: z.undefined(),
    assetConfig: z.undefined(),
    appCall: z.undefined(),
    assetFreeze: z.undefined(),
    heartbeat: z.undefined(),
    stateProof: z.undefined()
  });

/**
 * A signed key registration transaction type
 */
export type SignedKeyRegistrationTransaction = Omit<
  SignedTransaction,
  "txn"
> & {
  txn: KeyRegistrationTransaction;
};

/**
 * Zod schema for validating signed key registration transactions.
 * Validates all SignedTransaction fields with the txn field containing a key registration transaction.
 */
const signedKeyRegistrationTransactionSchema: z.ZodType<SignedKeyRegistrationTransaction> =
  z.object({
    txn: keyRegistrationTransactionSchema,
    signature: z.instanceof(Uint8Array).optional(),
    multiSignature: multisigSignatureSchema.optional(),
    logicSignature: logicSignatureSchema.optional(),
    authAddress: z.string().optional()
  });

/**
 * Helper to safely validate and extract key registration transaction data.
 * Returns the parsed data if valid, null otherwise.
 */
function parseKeyRegistrationTransaction(signedTx: SignedTransaction) {
  const result = signedKeyRegistrationTransactionSchema.safeParse(signedTx);
  return result.success ? result.data : null;
}

/**
 * Checks if a signed transaction is a key registration transaction.
 * Uses Zod validation to ensure type safety at runtime.
 */
export function isKeyRegistrationTransaction(
  signedTx: SignedTransaction
): boolean {
  return parseKeyRegistrationTransaction(signedTx) !== null;
}

/**
 * Checks if a signed transaction is an online key registration.
 * Online key registration has any participation fields (voteKey, selectionKey, stateProofKey, voteFirst, voteLast, voteKeyDilution).
 */
export function isOnlineKeyRegistration(signedTx: SignedTransaction): boolean {
  const parsed = parseKeyRegistrationTransaction(signedTx);
  if (parsed === null) return false;

  const keyReg = parsed.txn.keyRegistration;
  return (
    keyReg.voteKey !== undefined ||
    keyReg.selectionKey !== undefined ||
    keyReg.stateProofKey !== undefined ||
    keyReg.voteFirst !== undefined ||
    keyReg.voteLast !== undefined ||
    keyReg.voteKeyDilution !== undefined
  );
}

/**
 * Checks if a signed transaction is an offline key registration.
 * Offline key registration only has nonParticipation=true with no participation fields.
 */
export function isOfflineKeyRegistration(signedTx: SignedTransaction): boolean {
  const parsed = parseKeyRegistrationTransaction(signedTx);
  if (parsed === null) return false;

  const keyReg = parsed.txn.keyRegistration;
  const hasParticipationFields =
    keyReg.voteKey !== undefined ||
    keyReg.selectionKey !== undefined ||
    keyReg.stateProofKey !== undefined ||
    keyReg.voteFirst !== undefined ||
    keyReg.voteLast !== undefined ||
    keyReg.voteKeyDilution !== undefined;

  return !hasParticipationFields && keyReg.nonParticipation === true;
}

/**
 * Checks if a signed transaction is a key registration with voteKey set.
 */
export function isKeyRegistrationWithVoteKey(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseKeyRegistrationTransaction(signedTx);
  return parsed !== null && parsed.txn.keyRegistration.voteKey !== undefined;
}

/**
 * Checks if a signed transaction is a key registration with selectionKey set.
 */
export function isKeyRegistrationWithSelectionKey(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseKeyRegistrationTransaction(signedTx);
  return (
    parsed !== null && parsed.txn.keyRegistration.selectionKey !== undefined
  );
}

/**
 * Checks if a signed transaction is a key registration with stateProofKey set.
 */
export function isKeyRegistrationWithStateProofKey(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseKeyRegistrationTransaction(signedTx);
  return (
    parsed !== null && parsed.txn.keyRegistration.stateProofKey !== undefined
  );
}

/**
 * Checks if a signed transaction is a key registration from a specific sender.
 */
export function isKeyRegistrationFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseKeyRegistrationTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === senderAddress;
  };
}

/**
 * Checks if a signed transaction is an online key registration from a specific sender.
 */
export function isOnlineKeyRegistrationFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseKeyRegistrationTransaction(signedTx);
    if (parsed === null || parsed.txn.sender !== senderAddress) return false;

    const keyReg = parsed.txn.keyRegistration;
    return (
      keyReg.voteKey !== undefined ||
      keyReg.selectionKey !== undefined ||
      keyReg.stateProofKey !== undefined ||
      keyReg.voteFirst !== undefined ||
      keyReg.voteLast !== undefined ||
      keyReg.voteKeyDilution !== undefined
    );
  };
}

/**
 * Checks if a signed transaction is an offline key registration from a specific sender.
 */
export function isOfflineKeyRegistrationFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseKeyRegistrationTransaction(signedTx);
    if (parsed === null || parsed.txn.sender !== senderAddress) return false;

    const keyReg = parsed.txn.keyRegistration;
    const hasParticipationFields =
      keyReg.voteKey !== undefined ||
      keyReg.selectionKey !== undefined ||
      keyReg.stateProofKey !== undefined ||
      keyReg.voteFirst !== undefined ||
      keyReg.voteLast !== undefined ||
      keyReg.voteKeyDilution !== undefined;

    return !hasParticipationFields && keyReg.nonParticipation === true;
  };
}

/**
 * Checks if a signed transaction is a key registration with vote validity range.
 * Validates that voteFirst >= firstRound AND voteLast <= lastRound.
 */
export function isKeyRegistrationWithVoteRange(
  firstRound: bigint,
  lastRound: bigint
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseKeyRegistrationTransaction(signedTx);
    if (parsed === null) return false;

    const keyReg = parsed.txn.keyRegistration;
    if (keyReg.voteFirst === undefined || keyReg.voteLast === undefined)
      return false;

    return keyReg.voteFirst >= firstRound && keyReg.voteLast <= lastRound;
  };
}

/**
 * Checks if a signed transaction is a key registration with a specific vote key dilution value.
 */
export function isKeyRegistrationWithVoteDilation(dilationValue: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseKeyRegistrationTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.keyRegistration.voteKeyDilution === dilationValue
    );
  };
}

/**
 * Checks if a signed transaction is a key registration from a specific sender with vote validity range.
 * Combines sender check with vote range validation.
 */
export function isKeyRegistrationFromSenderWithVoteRange(
  senderAddress: string,
  firstRound: bigint,
  lastRound: bigint
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseKeyRegistrationTransaction(signedTx);
    if (parsed === null || parsed.txn.sender !== senderAddress) return false;

    const keyReg = parsed.txn.keyRegistration;
    if (keyReg.voteFirst === undefined || keyReg.voteLast === undefined)
      return false;

    return keyReg.voteFirst >= firstRound && keyReg.voteLast <= lastRound;
  };
}
