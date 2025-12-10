/**
 * Transaction-level validators and predicates.
 *
 * These functions work with SignedTransaction objects and can be used
 * with any array of signed transactions, not just pending transactions.
 *
 * @example
 * ```typescript
 * import { isPaymentWithNote } from '@algorandfoundation/algokit-utils/poller/schemas/transactions'
 *
 * const matchingTxs = signedTransactions.filter(isPaymentWithNote)
 * ```
 */

// Common schemas used across transaction types
export {
  logicSignatureSchema,
  multisigSignatureSchema,
  multisigSubsignatureSchema
} from "./common";

// Payment transaction validators
export {
  isPaymentTransaction,
  isPaymentToReceiver,
  isPaymentFromSender,
  isPaymentWithMinAmount,
  isPaymentBetweenAddresses,
  isPaymentWithNote,
  isPaymentWithSpecificNote,
  isPaymentWithNotePrefix,
  isPaymentWithCloseOut,
  isPaymentWithCloseOutToAddress,
  isPaymentWithCloseOutFromSender
} from "./payment";

// Asset transfer transaction validators
export {
  isAssetTransferTransaction,
  isAssetTransferToReceiver,
  isAssetTransferFromSender,
  isAssetTransferOfAsset,
  isAssetTransferWithMinAmount,
  isAssetTransferOfAssetToReceiver,
  isAssetTransferWithCloseOut,
  isAssetClawback
} from "./asset-transfer";

// Asset config transaction validators
export {
  isAssetConfigTransaction,
  isAssetCreation,
  isAssetReconfiguration,
  isAssetDestroy,
  isAssetConfigFromSender,
  isAssetConfigOfAsset,
  isAssetCreationWithName,
  isAssetCreationWithUnitName,
  isAssetConfigByManager,
  isAssetConfigSettingManager,
  isAssetConfigSettingReserve,
  isAssetConfigSettingFreeze,
  isAssetConfigSettingClawback,
  isAssetConfigWithManager,
  isAssetConfigWithReserve,
  isAssetConfigWithFreeze,
  isAssetConfigWithClawback,
  isAssetConfigRemovingManager,
  isAssetConfigRemovingFreeze,
  isAssetConfigRemovingClawback
} from "./asset-config";

// App call transaction validators
export {
  isAppCallTransaction,
  isAppCreation,
  isAppUpdate,
  isAppDelete,
  isAppOptIn,
  isAppCloseOut,
  isAppClearState,
  isAppNoOp,
  isAppCallToApp,
  isAppCallFromSender,
  isAppCallWithApprovalProgram,
  isAppCallWithClearStateProgram,
  isAppCallWithGlobalStateSchema,
  isAppCallWithLocalStateSchema,
  isAppCreationWithBothStateSchemas,
  isAppCreationWithExtraPages,
  isAppCallWithArgs,
  isAppCallWithAccountReferences,
  isAppCallWithAppReferences,
  isAppCallWithAssetReferences,
  isAppCallWithBoxReferences,
  isAppCallToAppWithOnComplete,
  isAppCallWithMinArgs,
  isAppCallWithSpecificArg
} from "./app-call";

// Key registration transaction validators
export {
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
} from "./key-registration";

// Asset freeze transaction validators
export {
  isAssetFreezeTransaction,
  isAssetFreeze,
  isAssetUnfreeze,
  isAssetFreezeFromSender,
  isAssetFreezeOfAsset,
  isAssetFreezeTargeting,
  isAssetFreezeOfAssetTargeting,
  isAssetFreezeOfAssetTargetingWithStatus,
  isAssetFreezeFromSenderOfAsset
} from "./asset-freeze";
