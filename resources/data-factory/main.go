package main

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/algorand/go-algorand/crypto"
	"github.com/algorand/go-algorand/data/basics"
	"github.com/algorand/go-algorand/data/bookkeeping"
	"github.com/algorand/go-algorand/data/transactions"
	"github.com/algorand/go-algorand/data/transactions/verify"
	"github.com/algorand/go-algorand/protocol"
)

// Values taken from data/transactions/verify/txn_test.go
var feeSink = basics.Address{0x7, 0xda, 0xcb, 0x4b, 0x6d, 0x9e, 0xd1, 0x41, 0xb1, 0x75, 0x76, 0xbd, 0x45, 0x9a, 0xe6, 0x42, 0x1d, 0x48, 0x6d, 0xa3, 0xd4, 0xef, 0x22, 0x47, 0xc4, 0x9, 0xa3, 0x96, 0xb8, 0x2e, 0xa2, 0x21}
var poolAddr = basics.Address{0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff}

func createDummyBlockHeader() bookkeeping.BlockHeader {
	proto := protocol.ConsensusCurrentVersion

	return bookkeeping.BlockHeader{
		Round:       1000,
		GenesisHash: crypto.Hash([]byte{1, 2, 3, 4, 5}),
		UpgradeState: bookkeeping.UpgradeState{
			CurrentProtocol: proto,
		},
		RewardsState: bookkeeping.RewardsState{
			FeeSink:     feeSink,
			RewardsPool: poolAddr,
		},
	}
}

// generateSecrets generates deterministic signature secrets for numAccs accounts
func generateSecrets(numAccs int) []*crypto.SignatureSecrets {
	secrets := make([]*crypto.SignatureSecrets, numAccs)

	for i := range numAccs {
		var seed crypto.Seed
		for j := range len(seed) {
			seed[j] = byte(i + j)
		}
		secret := crypto.GenerateSignatureSecrets(seed)
		secrets[i] = secret

	}
	return secrets
}

type TxData struct {
	SecretKey []byte                 `codec:"secretKey"`
	Stxn      transactions.SignedTxn `codec:"stxn"`
	StxnBlob  []byte                 `codec:"stxnBlob"`
	TxnBlob   []byte                 `codec:"txnBlob"`
	Id        string                 `codec:"id"`
}

type TestData struct {
	SimplePayment TxData `codec:"simplePayment"`
}

func main() {
	secrets := generateSecrets(1)

	ghB64 := "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

	ghBytes, err := base64.StdEncoding.DecodeString(ghB64)
	if err != nil {
		panic(err)
	}

	var gh [32]byte
	copy(gh[:], ghBytes)

	header := transactions.Header{
		Sender:      basics.Address(secrets[0].SignatureVerifier),
		FirstValid:  50659540,
		LastValid:   50660540,
		GenesisHash: gh,
		GenesisID:   "testnet-v1.0",
		Fee:         basics.MicroAlgos{Raw: 1000},
	}

	payFields := transactions.PaymentTxnFields{}
	payTxn := transactions.Transaction{
		Type:             protocol.PaymentTx,
		Header:           header,
		PaymentTxnFields: payFields,
	}

	stxn := transactions.SignedTxn{
		Txn: payTxn,
		Sig: secrets[0].Sign(payTxn),
	}

	blkHdr := createDummyBlockHeader()

	stxns := make([]transactions.SignedTxn, 1)
	stxns[0] = stxn

	_, err = verify.TxnGroup(stxns, &blkHdr, nil, nil)
	if err != nil {
		panic(err)
	}

	fmt.Println("Transaction group verified successfully")

	txData := TxData{
		SecretKey: secrets[0].SK[:],
		Stxn:      stxn,
		StxnBlob:  protocol.Encode(&stxn),
		TxnBlob:   protocol.Encode(&payTxn),
		Id:        payTxn.ID().String(),
	}

	testData := TestData{
		SimplePayment: txData,
	}

	testDataJson := protocol.EncodeJSON(&testData)
	fmt.Println("Test data encoded to JSON:", string(testDataJson))

	testDataFile := "transact_test_data.json"

	err = os.WriteFile(testDataFile, testDataJson, 0644)
	if err != nil {
		panic(err)
	}
	fmt.Println("Test data written to file:", testDataFile)

}
