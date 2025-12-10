import {
  GetPendingTransactions,
  GetPendingTransactionsMeta
} from "@algorandfoundation/algokit-utils/packages/algod_client/src/models/get-pending-transactions";
import type { OnApplicationComplete } from "@algorandfoundation/algokit-utils/packages/transact/src/transactions/app-call";
import { modelMetadataToZodSchema } from "../utils/zod-utils";
import {
  isAppCallFromSender,
  isAppCallToApp,
  isAppCallToAppWithOnComplete,
  isAppCallTransaction,
  isAppCallWithAccountReferences,
  isAppCallWithAppReferences,
  isAppCallWithArgs,
  isAppCallWithAssetReferences,
  isAppCallWithBoxReferences,
  isAppCallWithMinArgs,
  isAppCallWithSpecificArg,
  isAppClearState,
  isAppCloseOut,
  isAppCreation,
  isAppCreationWithBothStateSchemas,
  isAppCreationWithExtraPages,
  isAppDelete,
  isAppNoOp,
  isAppOptIn,
  isAppUpdate,
  isAssetClawback,
  isAssetConfigByManager,
  isAssetConfigFromSender,
  isAssetConfigOfAsset,
  isAssetConfigRemovingClawback,
  isAssetConfigRemovingFreeze,
  isAssetConfigRemovingManager,
  isAssetConfigSettingClawback,
  isAssetConfigSettingFreeze,
  isAssetConfigSettingManager,
  isAssetConfigSettingReserve,
  isAssetConfigTransaction,
  isAssetConfigWithClawback,
  isAssetConfigWithFreeze,
  isAssetConfigWithManager,
  isAssetCreation,
  isAssetCreationWithName,
  isAssetCreationWithUnitName,
  isAssetDestroy,
  isAssetReconfiguration,
  isAssetTransferFromSender,
  isAssetTransferOfAsset,
  isAssetTransferOfAssetToReceiver,
  isAssetTransferToReceiver,
  isAssetTransferTransaction,
  isAssetTransferWithCloseOut,
  isAssetTransferWithMinAmount,
  isAssetFreezeTransaction,
  isAssetFreeze,
  isAssetUnfreeze,
  isAssetFreezeFromSender,
  isAssetFreezeOfAsset,
  isAssetFreezeTargeting,
  isAssetFreezeOfAssetTargeting,
  isAssetFreezeOfAssetTargetingWithStatus,
  isAssetFreezeFromSenderOfAsset,
  isPaymentBetweenAddresses,
  isPaymentFromSender,
  isPaymentToReceiver,
  isPaymentTransaction,
  isPaymentWithCloseOut,
  isPaymentWithCloseOutFromSender,
  isPaymentWithCloseOutToAddress,
  isPaymentWithMinAmount,
  isPaymentWithNote,
  isPaymentWithNotePrefix,
  isPaymentWithSpecificNote,
  isKeyRegistrationTransaction,
  isOnlineKeyRegistration,
  isOfflineKeyRegistration,
  isKeyRegistrationWithVoteKey,
  isKeyRegistrationWithSelectionKey,
  isKeyRegistrationWithStateProofKey,
  isKeyRegistrationFromSender,
  isOnlineKeyRegistrationFromSender,
  isOfflineKeyRegistrationFromSender,
  isKeyRegistrationWithVoteRange,
  isKeyRegistrationWithVoteDilation,
  isKeyRegistrationFromSenderWithVoteRange
} from "../transactions";

/**
 * Base Zod schema for GetPendingTransactions response.
 * This schema validates the basic structure but treats SignedTransaction as z.unknown().
 *
 * Use this as a starting point and add `.refine()` to validate specific transaction properties.
 */
export const basePendingTransactionsSchema = modelMetadataToZodSchema(
  GetPendingTransactionsMeta
);

/**
 * Schema that matches when there are any pending transactions in the pool.
 */
export const anyPendingTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      return pendingTxs.totalTransactions > 0;
    },
    { message: "Waiting for any pending transactions" }
  );

/**
 * Schema that matches when there are any payment transactions in the pool.
 */
export const pendingPaymentTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isPaymentTransaction);
    },
    { message: "Waiting for any payment transaction" }
  );

/**
 * Creates a schema that matches pending payment transactions to a specific receiver.
 */
export function pendingPaymentToReceiverSchema(receiverAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentToReceiver(receiverAddress)
      );
    },
    { message: `Waiting for payment transaction to ${receiverAddress}` }
  );
}

/**
 * Creates a schema that matches pending payment transactions from a specific sender.
 */
export function pendingPaymentFromSenderSchema(senderAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentFromSender(senderAddress)
      );
    },
    { message: `Waiting for payment transaction from ${senderAddress}` }
  );
}

/**
 * Creates a schema that matches pending payment transactions with a minimum amount.
 */
export function pendingPaymentWithMinAmountSchema(minAmount: bigint) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isPaymentWithMinAmount(minAmount));
    },
    {
      message: `Waiting for payment transaction with minimum amount ${minAmount} microAlgos`
    }
  );
}

/**
 * Creates a schema that matches pending payment transactions between specific sender and receiver.
 */
export function pendingPaymentBetweenAddressesSchema(
  senderAddress: string,
  receiverAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentBetweenAddresses(senderAddress, receiverAddress)
      );
    },
    {
      message: `Waiting for payment from ${senderAddress} to ${receiverAddress}`
    }
  );
}

/**
 * Schema that matches pending payment transactions with any note.
 */
export const pendingPaymentWithNoteSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isPaymentWithNote);
    },
    { message: "Waiting for payment transaction with a note" }
  );

/**
 * Creates a schema that matches pending payment transactions with a specific note.
 */
export function pendingPaymentWithSpecificNoteSchema(expectedNote: Uint8Array) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentWithSpecificNote(expectedNote)
      );
    },
    { message: "Waiting for payment transaction with specific note" }
  );
}

/**
 * Creates a schema that matches pending payment transactions with a note prefix.
 */
export function pendingPaymentWithNotePrefixSchema(notePrefix: Uint8Array) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentWithNotePrefix(notePrefix)
      );
    },
    { message: "Waiting for payment transaction with note prefix" }
  );
}

/**
 * Schema that matches pending payment transactions with close-out.
 */
export const pendingPaymentWithCloseOutSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isPaymentWithCloseOut);
    },
    { message: "Waiting for payment transaction with close-out" }
  );

/**
 * Creates a schema that matches pending payment transactions with close-out to a specific address.
 */
export function pendingPaymentWithCloseOutToAddressSchema(
  closeToAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentWithCloseOutToAddress(closeToAddress)
      );
    },
    {
      message: `Waiting for payment transaction with close-out to ${closeToAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending payment transactions from a sender with close-out.
 */
export function pendingPaymentWithCloseOutFromSenderSchema(
  senderAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isPaymentWithCloseOutFromSender(senderAddress)
      );
    },
    {
      message: `Waiting for payment transaction from ${senderAddress} with close-out`
    }
  );
}

/**
 * Schema that matches when there are any asset transfer transactions in the pool.
 */
export const pendingAssetTransferTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetTransferTransaction);
    },
    { message: "Waiting for any asset transfer transaction" }
  );

/**
 * Creates a schema that matches pending asset transfer transactions to a specific receiver.
 */
export function pendingAssetTransferToReceiverSchema(receiverAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetTransferToReceiver(receiverAddress)
      );
    },
    { message: `Waiting for asset transfer transaction to ${receiverAddress}` }
  );
}

/**
 * Creates a schema that matches pending asset transfer transactions from a specific sender.
 */
export function pendingAssetTransferFromSenderSchema(senderAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetTransferFromSender(senderAddress)
      );
    },
    { message: `Waiting for asset transfer transaction from ${senderAddress}` }
  );
}

/**
 * Creates a schema that matches pending asset transfer transactions of a specific asset.
 */
export function pendingAssetTransferOfAssetSchema(assetId: bigint) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetTransferOfAsset(assetId));
    },
    { message: `Waiting for asset transfer transaction of asset ${assetId}` }
  );
}

/**
 * Creates a schema that matches pending asset transfer transactions with a minimum amount.
 */
export function pendingAssetTransferWithMinAmountSchema(minAmount: bigint) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetTransferWithMinAmount(minAmount)
      );
    },
    {
      message: `Waiting for asset transfer transaction with minimum amount ${minAmount}`
    }
  );
}

/**
 * Creates a schema that matches pending asset transfer transactions of a specific asset to a specific receiver.
 * This is useful for tracking specific asset payments to an address.
 */
export function pendingAssetTransferOfAssetToReceiverSchema(
  assetId: bigint,
  receiverAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetTransferOfAssetToReceiver(assetId, receiverAddress)
      );
    },
    {
      message: `Waiting for asset transfer of asset ${assetId} to ${receiverAddress}`
    }
  );
}

/**
 * Schema that matches pending asset transfer transactions with close-out.
 */
export const pendingAssetTransferWithCloseOutSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetTransferWithCloseOut);
    },
    { message: "Waiting for asset transfer transaction with close-out" }
  );

/**
 * Schema that matches pending asset clawback transactions.
 * A clawback is when the asset clawback address forcibly moves assets from one account to another.
 */
export const pendingAssetClawbackSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAssetClawback);
  },
  { message: "Waiting for asset clawback transaction" }
);

/**
 * Schema that matches when there are any asset config transactions in the pool.
 */
export const pendingAssetConfigTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigTransaction);
    },
    { message: "Waiting for any asset config transaction" }
  );

/**
 * Schema that matches pending asset creation transactions.
 * Asset creation is indicated by assetId === 0n.
 */
export const pendingAssetCreationSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAssetCreation);
  },
  { message: "Waiting for asset creation transaction" }
);

/**
 * Schema that matches pending asset reconfiguration transactions.
 */
export const pendingAssetReconfigurationSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetReconfiguration);
    },
    { message: "Waiting for asset reconfiguration transaction" }
  );

/**
 * Schema that matches pending asset destroy transactions.
 */
export const pendingAssetDestroySchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAssetDestroy);
  },
  { message: "Waiting for asset destroy transaction" }
);

/**
 * Schema that matches pending asset config transactions with a manager address set.
 */
export const pendingAssetConfigWithManagerSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigWithManager);
    },
    { message: "Waiting for asset config transaction with manager" }
  );

/**
 * Schema that matches pending asset config transactions with a freeze address set.
 */
export const pendingAssetConfigWithFreezeSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigWithFreeze);
    },
    { message: "Waiting for asset config transaction with freeze" }
  );

/**
 * Schema that matches pending asset config transactions with a clawback address set.
 */
export const pendingAssetConfigWithClawbackSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigWithClawback);
    },
    { message: "Waiting for asset config transaction with clawback" }
  );

/**
 * Creates a schema that matches pending asset config transactions from a specific sender.
 */
export function pendingAssetConfigFromSenderSchema(senderAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetConfigFromSender(senderAddress)
      );
    },
    { message: `Waiting for asset config transaction from ${senderAddress}` }
  );
}

/**
 * Creates a schema that matches pending asset config transactions for a specific asset.
 */
export function pendingAssetConfigOfAssetSchema(assetId: bigint) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigOfAsset(assetId));
    },
    { message: `Waiting for asset config transaction for asset ${assetId}` }
  );
}

/**
 * Creates a schema that matches pending asset creation transactions with a specific asset name.
 */
export function pendingAssetCreationWithNameSchema(assetName: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetCreationWithName(assetName)
      );
    },
    { message: `Waiting for asset creation with name ${assetName}` }
  );
}

/**
 * Creates a schema that matches pending asset creation transactions with a specific unit name.
 */
export function pendingAssetCreationWithUnitNameSchema(unitName: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetCreationWithUnitName(unitName)
      );
    },
    { message: `Waiting for asset creation with unit name ${unitName}` }
  );
}

/**
 * Creates a schema that matches pending asset config transactions from a specific manager.
 */
export function pendingAssetConfigByManagerSchema(managerAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetConfigByManager(managerAddress)
      );
    },
    {
      message: `Waiting for asset config transaction from manager ${managerAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset config transactions setting a specific manager.
 */
export function pendingAssetConfigSettingManagerSchema(managerAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetConfigSettingManager(managerAddress)
      );
    },
    {
      message: `Waiting for asset config transaction setting manager to ${managerAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset config transactions setting a specific reserve.
 */
export function pendingAssetConfigSettingReserveSchema(reserveAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetConfigSettingReserve(reserveAddress)
      );
    },
    {
      message: `Waiting for asset config transaction setting reserve to ${reserveAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset config transactions setting a specific freeze address.
 */
export function pendingAssetConfigSettingFreezeSchema(freezeAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetConfigSettingFreeze(freezeAddress)
      );
    },
    {
      message: `Waiting for asset config transaction setting freeze to ${freezeAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset config transactions setting a specific clawback address.
 */
export function pendingAssetConfigSettingClawbackSchema(
  clawbackAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetConfigSettingClawback(clawbackAddress)
      );
    },
    {
      message: `Waiting for asset config transaction setting clawback to ${clawbackAddress}`
    }
  );
}

/**
 * Schema that matches pending asset config transactions removing the manager.
 */
export const pendingAssetConfigRemovingManagerSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigRemovingManager);
    },
    { message: "Waiting for asset config transaction removing manager" }
  );

/**
 * Schema that matches pending asset config transactions removing the freeze address.
 */
export const pendingAssetConfigRemovingFreezeSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigRemovingFreeze);
    },
    { message: "Waiting for asset config transaction removing freeze" }
  );

/**
 * Schema that matches pending asset config transactions removing the clawback address.
 */
export const pendingAssetConfigRemovingClawbackSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetConfigRemovingClawback);
    },
    { message: "Waiting for asset config transaction removing clawback" }
  );

/**
 * Schema that matches when there are any app call transactions in the pool.
 */
export const pendingAppCallTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallTransaction);
    },
    { message: "Waiting for any app call transaction" }
  );

/**
 * Schema that matches pending app creation transactions.
 * App creation is indicated by appId === 0n.
 */
export const pendingAppCreationSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppCreation);
  },
  { message: "Waiting for app creation transaction" }
);

/**
 * Schema that matches pending app update transactions.
 */
export const pendingAppUpdateSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppUpdate);
  },
  { message: "Waiting for app update transaction" }
);

/**
 * Schema that matches pending app delete transactions.
 */
export const pendingAppDeleteSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppDelete);
  },
  { message: "Waiting for app delete transaction" }
);

/**
 * Schema that matches pending app opt-in transactions.
 */
export const pendingAppOptInSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppOptIn);
  },
  { message: "Waiting for app opt-in transaction" }
);

/**
 * Schema that matches pending app close-out transactions.
 */
export const pendingAppCloseOutSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppCloseOut);
  },
  { message: "Waiting for app close-out transaction" }
);

/**
 * Schema that matches pending app clear state transactions.
 */
export const pendingAppClearStateSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppClearState);
  },
  { message: "Waiting for app clear state transaction" }
);

/**
 * Schema that matches pending NoOp app call transactions.
 */
export const pendingAppNoOpSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAppNoOp);
  },
  { message: "Waiting for NoOp app call transaction" }
);

/**
 * Schema that matches pending app call transactions with arguments.
 */
export const pendingAppCallWithArgsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallWithArgs);
    },
    { message: "Waiting for app call transaction with arguments" }
  );

/**
 * Schema that matches pending app call transactions with account references.
 */
export const pendingAppCallWithAccountReferencesSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallWithAccountReferences);
    },
    { message: "Waiting for app call transaction with account references" }
  );

/**
 * Schema that matches pending app call transactions with app references.
 */
export const pendingAppCallWithAppReferencesSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallWithAppReferences);
    },
    { message: "Waiting for app call transaction with app references" }
  );

/**
 * Schema that matches pending app call transactions with asset references.
 */
export const pendingAppCallWithAssetReferencesSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallWithAssetReferences);
    },
    { message: "Waiting for app call transaction with asset references" }
  );

/**
 * Schema that matches pending app call transactions with box references.
 */
export const pendingAppCallWithBoxReferencesSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallWithBoxReferences);
    },
    { message: "Waiting for app call transaction with box references" }
  );

/**
 * Schema that matches pending app creation transactions with both state schemas.
 */
export const pendingAppCreationWithBothStateSchemasSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCreationWithBothStateSchemas);
    },
    { message: "Waiting for app creation transaction with both state schemas" }
  );

/**
 * Schema that matches pending app creation transactions with extra program pages.
 */
export const pendingAppCreationWithExtraPagesSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCreationWithExtraPages);
    },
    { message: "Waiting for app creation transaction with extra program pages" }
  );

/**
 * Creates a schema that matches pending app call transactions to a specific app.
 */
export function pendingAppCallToAppSchema(appId: bigint) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallToApp(appId));
    },
    { message: `Waiting for app call transaction to app ${appId}` }
  );
}

/**
 * Creates a schema that matches pending app call transactions from a specific sender.
 */
export function pendingAppCallFromSenderSchema(senderAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAppCallFromSender(senderAddress)
      );
    },
    { message: `Waiting for app call transaction from ${senderAddress}` }
  );
}

/**
 * Creates a schema that matches pending app call transactions to a specific app with a specific on-completion action.
 */
export function pendingAppCallToAppWithOnCompleteSchema(
  appId: bigint,
  onComplete: OnApplicationComplete
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAppCallToAppWithOnComplete(appId, onComplete)
      );
    },
    {
      message: `Waiting for app call transaction to app ${appId} with on-completion ${onComplete}`
    }
  );
}

/**
 * Creates a schema that matches pending app call transactions with at least the specified number of arguments.
 */
export function pendingAppCallWithMinArgsSchema(count: number) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAppCallWithMinArgs(count));
    },
    {
      message: `Waiting for app call transaction with at least ${count} arguments`
    }
  );
}

/**
 * Creates a schema that matches pending app call transactions with a specific argument at a specific index.
 */
export function pendingAppCallWithSpecificArgSchema(
  index: number,
  expectedArg: Uint8Array
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAppCallWithSpecificArg(index, expectedArg)
      );
    },
    {
      message: `Waiting for app call transaction with specific argument at index ${index}`
    }
  );
}

/**
 * Schema that matches when there are any key registration transactions in the pool.
 */
export const pendingKeyRegistrationTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isKeyRegistrationTransaction);
    },
    { message: "Waiting for any key registration transaction" }
  );

/**
 * Schema that matches pending online key registration transactions.
 * Online key registration has participation fields (voteKey, selectionKey, stateProofKey, vote rounds).
 */
export const pendingOnlineKeyRegistrationSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isOnlineKeyRegistration);
    },
    { message: "Waiting for online key registration transaction" }
  );

/**
 * Schema that matches pending offline key registration transactions.
 * Offline key registration only has nonParticipation=true with no participation fields.
 */
export const pendingOfflineKeyRegistrationSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isOfflineKeyRegistration);
    },
    { message: "Waiting for offline key registration transaction" }
  );

/**
 * Schema that matches pending key registration transactions with voteKey set.
 */
export const pendingKeyRegistrationWithVoteKeySchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isKeyRegistrationWithVoteKey);
    },
    { message: "Waiting for key registration transaction with vote key" }
  );

/**
 * Schema that matches pending key registration transactions with selectionKey set.
 */
export const pendingKeyRegistrationWithSelectionKeySchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isKeyRegistrationWithSelectionKey);
    },
    { message: "Waiting for key registration transaction with selection key" }
  );

/**
 * Schema that matches pending key registration transactions with stateProofKey set.
 */
export const pendingKeyRegistrationWithStateProofKeySchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isKeyRegistrationWithStateProofKey
      );
    },
    { message: "Waiting for key registration transaction with state proof key" }
  );

/**
 * Creates a schema that matches pending key registration transactions from a specific sender.
 */
export function pendingKeyRegistrationFromSenderSchema(senderAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isKeyRegistrationFromSender(senderAddress)
      );
    },
    {
      message: `Waiting for key registration transaction from ${senderAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending online key registration transactions from a specific sender.
 */
export function pendingOnlineKeyRegistrationFromSenderSchema(
  senderAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isOnlineKeyRegistrationFromSender(senderAddress)
      );
    },
    {
      message: `Waiting for online key registration transaction from ${senderAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending offline key registration transactions from a specific sender.
 */
export function pendingOfflineKeyRegistrationFromSenderSchema(
  senderAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isOfflineKeyRegistrationFromSender(senderAddress)
      );
    },
    {
      message: `Waiting for offline key registration transaction from ${senderAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending key registration transactions with vote validity range.
 * Validates that voteFirst >= firstRound AND voteLast <= lastRound.
 */
export function pendingKeyRegistrationWithVoteRangeSchema(
  firstRound: bigint,
  lastRound: bigint
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isKeyRegistrationWithVoteRange(firstRound, lastRound)
      );
    },
    {
      message: `Waiting for key registration transaction with vote range ${firstRound}-${lastRound}`
    }
  );
}

/**
 * Creates a schema that matches pending key registration transactions with a specific vote key dilution value.
 */
export function pendingKeyRegistrationWithVoteDilationSchema(
  dilationValue: bigint
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isKeyRegistrationWithVoteDilation(dilationValue)
      );
    },
    {
      message: `Waiting for key registration transaction with vote key dilution ${dilationValue}`
    }
  );
}

/**
 * Creates a schema that matches pending key registration transactions from a specific sender with vote validity range.
 */
export function pendingKeyRegistrationFromSenderWithVoteRangeSchema(
  senderAddress: string,
  firstRound: bigint,
  lastRound: bigint
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isKeyRegistrationFromSenderWithVoteRange(
          senderAddress,
          firstRound,
          lastRound
        )
      );
    },
    {
      message: `Waiting for key registration transaction from ${senderAddress} with vote range ${firstRound}-${lastRound}`
    }
  );
}

/**
 * Schema that matches pending asset freeze transactions (any type).
 */
export const pendingAssetFreezeTransactionsSchema =
  basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetFreezeTransaction);
    },
    { message: "Waiting for any asset freeze transaction" }
  );

/**
 * Schema that matches pending asset freeze operations (frozen=true).
 */
export const pendingAssetFreezeSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAssetFreeze);
  },
  { message: "Waiting for asset freeze operation (frozen=true)" }
);

/**
 * Schema that matches pending asset unfreeze operations (frozen=false).
 */
export const pendingAssetUnfreezeSchema = basePendingTransactionsSchema.refine(
  (data): data is GetPendingTransactions => {
    const pendingTxs = data as GetPendingTransactions;
    if (pendingTxs.totalTransactions === 0) return false;
    return pendingTxs.topTransactions.some(isAssetUnfreeze);
  },
  { message: "Waiting for asset unfreeze operation (frozen=false)" }
);

/**
 * Creates a schema that matches pending asset freeze transactions from a specific sender.
 */
export function pendingAssetFreezeFromSenderSchema(senderAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetFreezeFromSender(senderAddress)
      );
    },
    { message: `Waiting for asset freeze transaction from ${senderAddress}` }
  );
}

/**
 * Creates a schema that matches pending asset freeze transactions for a specific asset.
 */
export function pendingAssetFreezeOfAssetSchema(assetId: bigint) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(isAssetFreezeOfAsset(assetId));
    },
    { message: `Waiting for asset freeze transaction for asset ${assetId}` }
  );
}

/**
 * Creates a schema that matches pending asset freeze transactions targeting a specific account.
 */
export function pendingAssetFreezeTargetingSchema(targetAddress: string) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetFreezeTargeting(targetAddress)
      );
    },
    {
      message: `Waiting for asset freeze transaction targeting ${targetAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset freeze transactions for a specific asset targeting a specific account.
 */
export function pendingAssetFreezeOfAssetTargetingSchema(
  assetId: bigint,
  targetAddress: string
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetFreezeOfAssetTargeting(assetId, targetAddress)
      );
    },
    {
      message: `Waiting for asset freeze of asset ${assetId} targeting ${targetAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset freeze transactions for a specific asset targeting a specific account with a specific freeze status.
 */
export function pendingAssetFreezeOfAssetTargetingWithStatusSchema(
  assetId: bigint,
  targetAddress: string,
  frozen: boolean
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetFreezeOfAssetTargetingWithStatus(assetId, targetAddress, frozen)
      );
    },
    {
      message: `Waiting for asset ${frozen ? "freeze" : "unfreeze"} of asset ${assetId} targeting ${targetAddress}`
    }
  );
}

/**
 * Creates a schema that matches pending asset freeze transactions from a specific sender for a specific asset.
 */
export function pendingAssetFreezeFromSenderOfAssetSchema(
  senderAddress: string,
  assetId: bigint
) {
  return basePendingTransactionsSchema.refine(
    (data): data is GetPendingTransactions => {
      const pendingTxs = data as GetPendingTransactions;
      if (pendingTxs.totalTransactions === 0) return false;
      return pendingTxs.topTransactions.some(
        isAssetFreezeFromSenderOfAsset(senderAddress, assetId)
      );
    },
    {
      message: `Waiting for asset freeze from ${senderAddress} for asset ${assetId}`
    }
  );
}
