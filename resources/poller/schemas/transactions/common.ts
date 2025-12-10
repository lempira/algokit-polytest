import type {
  LogicSignature,
  MultisigSignature,
  MultisigSubsignature
} from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/signed-transaction";
import { z } from "zod";

/**
 * Common transaction schemas shared across different transaction types.
 */

/**
 * Zod schema for multisig subsignature.
 * Corresponds to {@link MultisigSubsignature} from @algorandfoundation/algokit-transact
 */
export const multisigSubsignatureSchema: z.ZodType<MultisigSubsignature> =
  z.object({
    address: z.string(),
    signature: z.instanceof(Uint8Array).optional()
  });

/**
 * Zod schema for multisig signature.
 * Corresponds to {@link MultisigSignature} from @algorandfoundation/algokit-transact
 */
export const multisigSignatureSchema: z.ZodType<MultisigSignature> = z.object({
  version: z.number(),
  threshold: z.number(),
  subsignatures: z.array(multisigSubsignatureSchema)
});

/**
 * Zod schema for logic signature.
 * Corresponds to {@link LogicSignature} from @algorandfoundation/algokit-transact
 */
export const logicSignatureSchema: z.ZodType<LogicSignature> = z.object({
  logic: z.instanceof(Uint8Array),
  args: z.array(z.instanceof(Uint8Array)).optional(),
  signature: z.instanceof(Uint8Array).optional(),
  multiSignature: multisigSignatureSchema.optional(),
  logicMultiSignature: multisigSignatureSchema.optional()
});
