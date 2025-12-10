import type { SignedTransaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import type { Transaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/transaction";
import type {
  AppCallTransactionFields,
  OnApplicationComplete,
  StateSchema,
  BoxReference
} from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/app-call";
import { z } from "zod";
import { logicSignatureSchema, multisigSignatureSchema } from "./common";

/**
 * Transaction-level validators for app call transactions.
 * These can be used with any array of SignedTransactions, not just pending transactions.
 *
 * All validators use Zod for runtime validation to ensure type safety.
 */

/**
 * Zod schema for StateSchema.
 */
const stateSchemaSchema: z.ZodType<StateSchema> = z.object({
  numUints: z.number(),
  numByteSlices: z.number()
});

/**
 * Zod schema for BoxReference.
 */
const boxReferenceSchema: z.ZodType<BoxReference> = z.object({
  appId: z.bigint(),
  name: z.instanceof(Uint8Array)
});

/**
 * Zod schema for app call transaction fields.
 * Corresponds to {@link AppCallTransactionFields} from @algorandfoundation/algokit-transact
 */
const appCallFieldsSchema: z.ZodType<AppCallTransactionFields> = z.object({
  appId: z.bigint(),
  onComplete: z.number(),
  approvalProgram: z.instanceof(Uint8Array).optional(),
  clearStateProgram: z.instanceof(Uint8Array).optional(),
  globalStateSchema: stateSchemaSchema.optional(),
  localStateSchema: stateSchemaSchema.optional(),
  extraProgramPages: z.number().optional(),
  args: z.array(z.instanceof(Uint8Array)).optional(),
  accountReferences: z.array(z.string()).optional(),
  appReferences: z.array(z.bigint()).optional(),
  assetReferences: z.array(z.bigint()).optional(),
  boxReferences: z.array(boxReferenceSchema).optional(),
  accessReferences: z.array(z.any()).optional()
});

/**
 * An app call transaction is a {@link Transaction} with type='appl' and an appCall field.
 * It has all the common transaction attributes (sender, firstValid, lastValid, fee, note, etc.).
 */
export type AppCallTransaction = Omit<Transaction, "type" | "appCall"> & {
  type: "appl";
  appCall: AppCallTransactionFields;
};

/**
 * Zod schema for validating app call transactions.
 * Validates all Transaction fields plus the appCall-specific field.
 */
const appCallTransactionSchema: z.ZodType<AppCallTransaction> = z.object({
  // Transaction type
  type: z.literal("appl"),

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

  // App call-specific field
  appCall: appCallFieldsSchema,

  // Other transaction type fields (should be undefined for app call transactions)
  payment: z.undefined(),
  assetTransfer: z.undefined(),
  assetConfig: z.undefined(),
  keyRegistration: z.undefined(),
  assetFreeze: z.undefined(),
  heartbeat: z.undefined(),
  stateProof: z.undefined()
});

/**
 * A signed app call transaction type
 */
export type SignedAppCallTransaction = Omit<SignedTransaction, "txn"> & {
  txn: AppCallTransaction;
};

/**
 * Zod schema for validating signed app call transactions.
 * Validates all SignedTransaction fields with the txn field containing an app call transaction.
 */
const signedAppCallTransactionSchema: z.ZodType<SignedAppCallTransaction> =
  z.object({
    txn: appCallTransactionSchema,
    signature: z.instanceof(Uint8Array).optional(),
    multiSignature: multisigSignatureSchema.optional(),
    logicSignature: logicSignatureSchema.optional(),
    authAddress: z.string().optional()
  });

/**
 * Helper to safely validate and extract app call transaction data.
 * Returns the parsed data if valid, null otherwise.
 */
function parseAppCallTransaction(signedTx: SignedTransaction) {
  const result = signedAppCallTransactionSchema.safeParse(signedTx);
  return result.success ? result.data : null;
}

/**
 * Checks if a signed transaction is an app call transaction.
 * Uses Zod validation to ensure type safety at runtime.
 */
export function isAppCallTransaction(signedTx: SignedTransaction): boolean {
  return parseAppCallTransaction(signedTx) !== null;
}

/**
 * Checks if a signed transaction is an app creation.
 * App creation is indicated by appId === 0n.
 */
export function isAppCreation(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.appId === 0n;
}

/**
 * Checks if a signed transaction is an app update operation.
 * Update is when onComplete === UpdateApplication (4).
 */
export function isAppUpdate(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.onComplete === 4;
}

/**
 * Checks if a signed transaction is an app delete operation.
 * Delete is when onComplete === DeleteApplication (5).
 */
export function isAppDelete(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.onComplete === 5;
}

/**
 * Checks if a signed transaction is an app opt-in operation.
 * Opt-in is when onComplete === OptIn (1).
 */
export function isAppOptIn(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.onComplete === 1;
}

/**
 * Checks if a signed transaction is an app close-out operation.
 * Close-out is when onComplete === CloseOut (2).
 */
export function isAppCloseOut(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.onComplete === 2;
}

/**
 * Checks if a signed transaction is an app clear state operation.
 * Clear state is when onComplete === ClearState (3).
 */
export function isAppClearState(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.onComplete === 3;
}

/**
 * Checks if a signed transaction is a NoOp app call.
 * NoOp is when onComplete === NoOp (0).
 */
export function isAppNoOp(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.onComplete === 0;
}

/**
 * Checks if a signed transaction is an app call to a specific app.
 */
export function isAppCallToApp(appId: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAppCallTransaction(signedTx);
    return parsed !== null && parsed.txn.appCall.appId === appId;
  };
}

/**
 * Checks if a signed transaction is an app call from a specific sender.
 */
export function isAppCallFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAppCallTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === senderAddress;
  };
}

/**
 * Checks if a signed transaction is an app call with an approval program.
 */
export function isAppCallWithApprovalProgram(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.approvalProgram !== undefined &&
    parsed.txn.appCall.approvalProgram.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call with a clear state program.
 */
export function isAppCallWithClearStateProgram(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.clearStateProgram !== undefined &&
    parsed.txn.appCall.clearStateProgram.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call with a global state schema.
 */
export function isAppCallWithGlobalStateSchema(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.globalStateSchema !== undefined;
}

/**
 * Checks if a signed transaction is an app call with a local state schema.
 */
export function isAppCallWithLocalStateSchema(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return parsed !== null && parsed.txn.appCall.localStateSchema !== undefined;
}

/**
 * Checks if a signed transaction is an app creation with both state schemas.
 */
export function isAppCreationWithBothStateSchemas(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.appId === 0n &&
    parsed.txn.appCall.globalStateSchema !== undefined &&
    parsed.txn.appCall.localStateSchema !== undefined
  );
}

/**
 * Checks if a signed transaction is an app creation with extra program pages.
 */
export function isAppCreationWithExtraPages(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.appId === 0n &&
    parsed.txn.appCall.extraProgramPages !== undefined &&
    parsed.txn.appCall.extraProgramPages > 0
  );
}

/**
 * Checks if a signed transaction is an app call with arguments.
 */
export function isAppCallWithArgs(signedTx: SignedTransaction): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.args !== undefined &&
    parsed.txn.appCall.args.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call with account references.
 */
export function isAppCallWithAccountReferences(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.accountReferences !== undefined &&
    parsed.txn.appCall.accountReferences.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call with app references.
 */
export function isAppCallWithAppReferences(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.appReferences !== undefined &&
    parsed.txn.appCall.appReferences.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call with asset references.
 */
export function isAppCallWithAssetReferences(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.assetReferences !== undefined &&
    parsed.txn.appCall.assetReferences.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call with box references.
 */
export function isAppCallWithBoxReferences(
  signedTx: SignedTransaction
): boolean {
  const parsed = parseAppCallTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.appCall.boxReferences !== undefined &&
    parsed.txn.appCall.boxReferences.length > 0
  );
}

/**
 * Checks if a signed transaction is an app call to a specific app with a specific on-completion action.
 */
export function isAppCallToAppWithOnComplete(
  appId: bigint,
  onComplete: OnApplicationComplete
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAppCallTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.appCall.appId === appId &&
      parsed.txn.appCall.onComplete === onComplete
    );
  };
}

/**
 * Checks if a signed transaction is an app call with at least the specified number of arguments.
 */
export function isAppCallWithMinArgs(count: number) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAppCallTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.appCall.args !== undefined &&
      parsed.txn.appCall.args.length >= count
    );
  };
}

/**
 * Checks if a signed transaction is an app call with a specific argument at a specific index.
 */
export function isAppCallWithSpecificArg(
  index: number,
  expectedArg: Uint8Array
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parseAppCallTransaction(signedTx);
    if (
      parsed === null ||
      !parsed.txn.appCall.args ||
      parsed.txn.appCall.args.length <= index
    )
      return false;

    const arg = parsed.txn.appCall.args[index];
    if (arg.length !== expectedArg.length) return false;
    return arg.every((byte, i) => byte === expectedArg[i]);
  };
}
