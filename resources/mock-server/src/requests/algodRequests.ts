import { Algodv2 } from "algosdk";

export async function algosdkAlgodRequests() {
  // TestNet configuration (using AlgoNode public API)
  const algod = new Algodv2(
    "a".repeat(64),
    "https://testnet-api.4160.nodely.dev",
    443
  );

  // ========================================
  // TEST DATA SOURCES:
  // - Rounds from utils-py test_block.py and test_ledger_state_delta.py
  // - Other params from Lora object mothers
  // ========================================

  // From utils-py: Verified TestNet blocks with state proof transactions
  // For simplicity, we use only the first round here
  const round = 24099447;
  // Use to test multiple rounds, loop through the rounds
  const round2 = 24099347;

  // From Lora: TestNet object mothers
  const address = "25M5BT2DMMED3V6CWDEYKSNEFGPXX4QBIINCOICLXXRU3UGTSGRMF3MTOE";
  const appId = 718348254; // testnet
  const appIdWithBoxes = 742949200; // xgov testnet
  const assetId = 705457144;
  const txId = "VIXTUMAPT7NR4RB2WVOGMETW4QY43KIDA3HWDWWXS3UEDKGTEECQ";

  // ============================================
  // NO PARAMETERS NEEDED
  // ============================================

  // GET /v2/status
  await algod.status().do();

  // GET /health
  await algod.healthCheck().do();

  // GET /ready
  await algod.ready().do();

  // GET /genesis
  await algod.genesis().do();

  // GET /versions
  await algod.versionsCheck().do();

  // ============================================
  // ROUND-BASED ENDPOINTS (using utils-py rounds)
  // ============================================

  // GET /v2/status/wait-for-block-after/{round}
  await algod.statusAfterBlock(round).do();

  // GET /v2/blocks/{round}
  await algod.block(round).do();

  // GET /v2/blocks/{round}/hash
  await algod.getBlockHash(round).do();

  // GET /v2/blocks/{round}/lightheader/proof
  await algod.getLightBlockHeaderProof(round).do();

  // GET /v2/blocks/{round}/txids
  await algod.getBlockTxids(round).do();

  // GET /v2/deltas/{round}
  // Multiple rounds from Python tests to get comprehensive delta data
  const deltaRounds = [24099447, 24099347];
  for (const deltaRound of deltaRounds) {
    await algod.getLedgerStateDelta(deltaRound).do();
  }

  // GET /v2/stateproofs/{round}
  // TODO: find a valid value. Will likely have to be done with localnet
  // const stateProof = await algod.getStateProof(round).do();

  // GET /v2/blocks/{round}/transactions/{txid}/proof
  const roundWithTxnProof = 57624474;
  const txIdWithProof = "7KOOPZMUTVFHZ2PKXBGSOR6KZUYJA7P5QY257XNJZLR4NQ7IOW7A";
  await algod.getTransactionProof(roundWithTxnProof, txIdWithProof).do();

  // ============================================
  // ADDRESS-BASED ENDPOINTS (using Lora address)
  // ============================================

  // GET /v2/accounts/{address}
  await algod.accountInformation(address).do();

  // GET /v2/accounts/{address}/applications/{application-id}
  await algod.accountApplicationInformation(address, appId).do();

  // GET /v2/accounts/{address}/assets/{asset-id}
  await algod.accountAssetInformation(address, assetId).do();

  // GET /v2/accounts/{address}/transactions/pending
  await algod.pendingTransactionByAddress(address).do();

  // ============================================
  // APPLICATION ENDPOINTS
  // ============================================

  // GET /v2/applications/{application-id}
  const app = await algod.getApplicationByID(appId).do();

  // GET /v2/applications/{application-id}/box
  const boxName = Buffer.from(
    "cBbHBNV+zUy/Mz5IRhIrBLxr1on5wmidhXEavV+SasC8",
    "base64"
  );
  await algod.getApplicationBoxByName(appIdWithBoxes, boxName).do();

  // GET /v2/applications/{application-id}/boxes
  await algod.getApplicationBoxes(appIdWithBoxes).do();
  // TOOD: This currently doesn't work, needs to be fixed. The api doesn't work either
  // https://testnet-api.4160.nodely.dev/v2/applications/745893371/boxes?max=10
  // await algod.getApplicationBoxes(appIdWithBoxes).max(10).do();

  // ============================================
  // ASSET ENDPOINTS (using Lora assetId)
  // ============================================

  // GET /v2/assets/{asset-id}
  const asset = await algod.getAssetByID(assetId).do();

  // ============================================
  // TRANSACTION ENDPOINTS (using Lora txId)
  // ============================================

  // GET /v2/transactions/params
  // Python assertions: genesisId is non-empty, minFee > 0
  await algod.getTransactionParams().do();

  // GET /v2/transactions/pending
  await algod.pendingTransactionsInformation().do();

  // GET /v2/transactions/pending/{txid}
  // TODO: find valid values
  // const pending = await algod.pendingTransactionInformation(txId).do();

  // ============================================
  // OTHER ENDPOINTS
  // ============================================

  // GET /v2/ledger/supply
  await algod.supply().do();

  // GET /v2/ledger/sync
  await algod.getSyncRound().do();

  // ============================================
  // SKIPPED ENDPOINTS
  // ============================================

  // GET /v2/deltas/{round}/txn/group
  // SKIP: Returns 501 (Not Implemented) on public Nodely APIs
  // Requires node with ledger tracer enabled (EnableLedgerStateDeltaTracer config)
  // Verified: Tested rounds 24099447, 24099347 and latest 100 blocks - all return 501
  // const txnGroupDeltas = await algod.getTransactionGroupLedgerStateDeltasForRound(round).do();

  // GET /v2/deltas/txn/group/{id}
  // SKIP: Depends on above endpoint, also requires ledger tracer configuration
  // Returns errors when called on public APIs
  // const groupId = "VALID_GROUP_ID";
  // const deltaForGroup = await algod.getLedgerStateDeltaForTransactionGroup(groupId).do();

  // GET /v2/devmode/blocks/offset
  // SKIP: This will be done with localnet
  // const currentOffset = await algod.getBlockOffsetTimestamp().do();
}

export async function algosdkAlgodRequestsWithMainnet() {
  // MainNet configuration - StateProofs are only available on MainNet
  // URL will be normalized to TestNet for ID generation and HAR storage
  const algod = new Algodv2(
    "a".repeat(64),
    "https://mainnet-api.4160.nodely.dev",
    443
  );

  // GET /v2/deltas/{round} - MainNet rounds from Python tests
  // Round 56492866 is an empty block (no transactions) with new protocol format
  const mainnetDeltaRounds = [55240407, 56492866];
  for (const deltaRound of mainnetDeltaRounds) {
    await algod.getLedgerStateDelta(deltaRound).do();
  }

  // GET /v2/stateproofs/{round}
  // Using valid stateproof from find-blocks-with-stateproof.ts script
  const stateProofRound = 56950528;
  await algod.getStateProof(stateProofRound).do();
}

export async function algosdkAlgodRequestsApiCalls() {
  // TestNet configuration (using Nodely public API)
  const algod = new Algodv2(
    "a".repeat(64),
    "https://testnet-api.4160.nodely.dev",
    443
  );

  // ========================================
  // ENDPOINTS NOT IMPLEMENTED IN SDK
  // These require direct HTTP calls using the internal HTTP client
  // ========================================

  // GET /metrics
  // Prometheus metrics endpoint (unversioned path)
  try {
    await (algod as any).c.get({
      relativePath: "/metrics",
      requestHeaders: { Accept: "text/plain" }
    });
  } catch (error) {
    // Metrics endpoint may not be available on public APIs
    console.log("Metrics endpoint not available");
  }

  // GET /swagger.json
  // OpenAPI specification (unversioned path)
  try {
    await (algod as any).c.get({
      relativePath: "/swagger.json"
    });
  } catch (error) {
    console.log("Swagger endpoint not available");
  }

  // GET /v2/experimental
  // Experimental features endpoint
  try {
    await (algod as any).c.get({
      relativePath: "/v2/experimental"
    });
  } catch (error) {
    console.log("Experimental endpoint not available");
  }

  // ============================================
  // ACCOUNT ENDPOINTS
  // ============================================

  // GET /v2/accounts/{address}/assets
  // List all assets held by an account
  const address = "25M5BT2DMMED3V6CWDEYKSNEFGPXX4QBIINCOICLXXRU3UGTSGRMF3MTOE";
  try {
    await (algod as any).c.get({
      relativePath: `/v2/accounts/${address}/assets`
    });
  } catch (error) {
    console.log("Account assets endpoint not available");
  }

  // ============================================
  // PARTICIPATION ENDPOINTS (node operator only)
  // ============================================

  // GET /v2/participation
  // List participation keys (requires node operator access)
  // TODO: getting 401, requires api access
  // try {
  //   await (algod as any).c.get({
  //     relativePath: "/v2/participation"
  //   });
  // } catch (error) {
  //   console.log(
  //     "Participation list endpoint not available (requires node access)"
  //   );
  // }

  // GET /v2/participation/{participation-id}
  // Get a specific participation key by ID
  // TODO: Need a valid participation ID from a node operator
  // const participationId = "PARTICIPATION_ID";
  // try {
  //   await (algod as any).c.get({
  //     relativePath: `/v2/participation/${participationId}`,
  //   });
  // } catch (error) {
  //   console.log("Participation endpoint not available");
  // }

  // ============================================
  // BLOCK LOGS ENDPOINTS
  // ============================================

  // GET /v2/blocks/{round}/logs
  // Get logs for a specific round
  const round = 24099447;
  try {
    await (algod as any).c.get({
      relativePath: `/v2/blocks/${round}/logs`
    });
  } catch (error) {
    console.log("Block logs endpoint not available");
  }

  // ============================================
  // DEBUG ENDPOINTS (node operator only, requires EnableDeveloperAPI)
  // ============================================

  // GET /debug/settings/pprof
  // Get pprof settings (requires node operator access)
  // TODO: this endpoint needs credentials

  // try {
  //   await (algod as any).c.get({
  //     relativePath: "/debug/settings/pprof",
  //   });
  // } catch (error) {
  //   console.log("Debug pprof endpoint not available (requires node access)");
  // }

  // GET /debug/settings/config
  // Get node configuration (requires node operator access)
  // TODO: this endpoint needs credentials
  // try {
  //   await (algod as any).c.get({
  //     relativePath: "/debug/settings/config"
  //   });
  // } catch (error) {
  //   console.log("Debug config endpoint not available (requires node access)");
  // }
}
