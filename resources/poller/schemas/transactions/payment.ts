import type { PaymentTransactionFields } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/payment";
import type { SignedTransaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import type { Transaction } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/transaction";
import { z } from "zod";
import { logicSignatureSchema, multisigSignatureSchema } from "./common";

/**
 * Transaction-level validators for payment transactions.
 * These can be used with any array of SignedTransactions, not just pending transactions.
 *
 * All validators use Zod for runtime validation to ensure type safety.
 */

/**
 * Zod schema for payment transaction fields.
 * Corresponds to {@link PaymentTransactionFields} from @algorandfoundation/algokit-transact
 */
const paymentFieldsSchema: z.ZodType<PaymentTransactionFields> = z.object({
  receiver: z.string(),
  amount: z.bigint(),
  closeRemainderTo: z.string().optional()
});

/**
 * A payment transaction is a {@link Transaction} with type='pay' and a payment field.
 * It has all the common transaction attributes (sender, firstValid, lastValid, fee, note, etc.).
 */
export type PaymentTransaction = Omit<Transaction, "type" | "payment"> & {
  type: "pay";
  payment: PaymentTransactionFields;
};

/**
 * Zod schema for validating payment transactions.
 * Validates all Transaction fields plus the payment-specific field.
 */
const paymentTransactionSchema: z.ZodType<PaymentTransaction> = z.object({
  // Transaction type
  type: z.literal("pay"),

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

  // Payment-specific field
  payment: paymentFieldsSchema,

  // Other transaction type fields (should be undefined for payment transactions)
  assetTransfer: z.undefined(),
  assetConfig: z.undefined(),
  appCall: z.undefined(),
  keyRegistration: z.undefined(),
  assetFreeze: z.undefined(),
  heartbeat: z.undefined(),
  stateProof: z.undefined()
});

/**
 * A signed payment transaction type
 */
export type SignedPaymentTransaction = Omit<SignedTransaction, "txn"> & {
  txn: PaymentTransaction;
};

/**
 * Zod schema for validating signed payment transactions.
 * Validates all SignedTransaction fields with the txn field containing a payment transaction.
 */
const signedPaymentTransactionSchema: z.ZodType<SignedPaymentTransaction> =
  z.object({
    txn: paymentTransactionSchema,
    signature: z.instanceof(Uint8Array).optional(),
    multiSignature: multisigSignatureSchema.optional(),
    logicSignature: logicSignatureSchema.optional(),
    authAddress: z.string().optional()
  });

/**
 * Helper to safely validate and extract payment transaction data.
 * Returns the parsed data if valid, null otherwise.
 */
function parsePaymentTransaction(signedTx: SignedTransaction) {
  const result = signedPaymentTransactionSchema.safeParse(signedTx);
  return result.success ? result.data : null;
}

/**
 * Checks if a signed transaction is a payment transaction.
 * Uses Zod validation to ensure type safety at runtime.
 */
export function isPaymentTransaction(signedTx: SignedTransaction): boolean {
  return parsePaymentTransaction(signedTx) !== null;
}

/**
 * Checks if a signed transaction is a payment to a specific receiver.
 */
export function isPaymentToReceiver(receiverAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    return parsed !== null && parsed.txn.payment.receiver === receiverAddress;
  };
}

/**
 * Checks if a signed transaction is a payment from a specific sender.
 */
export function isPaymentFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    return parsed !== null && parsed.txn.sender === senderAddress;
  };
}

/**
 * Checks if a signed transaction is a payment with at least the specified amount.
 */
export function isPaymentWithMinAmount(minAmount: bigint) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    return parsed !== null && parsed.txn.payment.amount >= minAmount;
  };
}

/**
 * Checks if a signed transaction is a payment between specific addresses.
 */
export function isPaymentBetweenAddresses(
  senderAddress: string,
  receiverAddress: string
) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.sender === senderAddress &&
      parsed.txn.payment.receiver === receiverAddress
    );
  };
}

/**
 * Checks if a signed transaction is a payment with any note.
 */
export function isPaymentWithNote(signedTx: SignedTransaction): boolean {
  const parsed = parsePaymentTransaction(signedTx);
  return (
    parsed !== null &&
    parsed.txn.note !== undefined &&
    parsed.txn.note.length > 0
  );
}

/**
 * Checks if a signed transaction is a payment with a specific note.
 */
export function isPaymentWithSpecificNote(expectedNote: Uint8Array) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    if (parsed === null || !parsed.txn.note) return false;
    if (parsed.txn.note.length !== expectedNote.length) return false;
    return parsed.txn.note.every((byte, index) => byte === expectedNote[index]);
  };
}

/**
 * Checks if a signed transaction is a payment with a note starting with a specific prefix.
 */
export function isPaymentWithNotePrefix(notePrefix: Uint8Array) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    if (parsed === null || !parsed.txn.note) return false;
    if (parsed.txn.note.length < notePrefix.length) return false;
    return notePrefix.every((byte, index) => parsed.txn.note![index] === byte);
  };
}

/**
 * Checks if a signed transaction is a payment with close-out.
 */
export function isPaymentWithCloseOut(signedTx: SignedTransaction): boolean {
  const parsed = parsePaymentTransaction(signedTx);
  return parsed !== null && parsed.txn.payment.closeRemainderTo !== undefined;
}

/**
 * Checks if a signed transaction is a payment with close-out to a specific address.
 */
export function isPaymentWithCloseOutToAddress(closeToAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    return (
      parsed !== null && parsed.txn.payment.closeRemainderTo === closeToAddress
    );
  };
}

/**
 * Checks if a signed transaction is a payment from a sender with close-out.
 */
export function isPaymentWithCloseOutFromSender(senderAddress: string) {
  return (signedTx: SignedTransaction): boolean => {
    const parsed = parsePaymentTransaction(signedTx);
    return (
      parsed !== null &&
      parsed.txn.sender === senderAddress &&
      parsed.txn.payment.closeRemainderTo !== undefined
    );
  };
}
