package main

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/algorand/go-algorand/crypto"
	"github.com/algorand/go-algorand/data/basics"
	"github.com/algorand/go-algorand/data/bookkeeping"
	"github.com/algorand/go-algorand/data/transactions"
	"github.com/algorand/go-algorand/data/transactions/logic"
	"github.com/algorand/go-algorand/data/transactions/verify"
	"github.com/algorand/go-algorand/ledger/ledgercore"
	"github.com/algorand/go-algorand/protocol"
)

type DummyLedgerForSignature struct{}

func (d *DummyLedgerForSignature) BlockHdr(rnd basics.Round) (blk bookkeeping.BlockHeader, err error) {
	return createDummyBlockHeader(), nil
}

func (d *DummyLedgerForSignature) GenesisHash() crypto.Digest {
	return crypto.Digest{}
}

func (d *DummyLedgerForSignature) Latest() basics.Round {
	return 0
}

func (d *DummyLedgerForSignature) RegisterBlockListeners([]ledgercore.BlockListener) {}

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

func generateMsigAddr(pks [3]crypto.PublicKey) basics.Address {
	addr, err := crypto.MultisigAddrGen(1, 2, pks[:])

	if err != nil {
		panic(err)
	}

	return basics.Address(addr)
}

type TxData struct {
	Signer   Signer                 `codec:"signer"`
	Stxn     transactions.SignedTxn `codec:"stxn"`
	StxnBlob []byte                 `codec:"stxnBlob"`
	TxnBlob  []byte                 `codec:"txnBlob"`
	Id       string                 `codec:"id"`
}

type Signer struct {
	SingleSigner *crypto.SignatureSecrets  `codec:"singleSigner,omitempty"`
	MsigSigners  []crypto.SignatureSecrets `codec:"msigSigners,omitempty"`
	Lsig         []byte                    `codec:"lsig,omitempty"`
}

func makeTxData(txType protocol.TxType, fields any, signer Signer) TxData {
	ghB64 := "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

	ghBytes, err := base64.StdEncoding.DecodeString(ghB64)
	if err != nil {
		panic(err)
	}

	var gh [32]byte
	copy(gh[:], ghBytes)

	header := transactions.Header{
		// No Sender because it is set later
		FirstValid:  50659540,
		LastValid:   50660540,
		GenesisHash: gh,
		GenesisID:   "testnet-v1.0",
		Fee:         basics.MicroAlgos{Raw: 1000},
	}

	stxn := transactions.SignedTxn{}
	switch txType {
	case protocol.PaymentTx:
		stxn.Txn = transactions.Transaction{
			Type:             protocol.PaymentTx,
			Header:           header,
			PaymentTxnFields: fields.(transactions.PaymentTxnFields),
		}
	// Add other transaction types as needed
	default:
		panic("Unsupported transaction type")
	}

	if len(signer.Lsig) > 0 {
		program := logic.Program(signer.Lsig)
		stxn.Lsig.Logic = signer.Lsig

		if signer.SingleSigner != nil {
			stxn.Txn.Sender = basics.Address(signer.SingleSigner.SignatureVerifier)
			stxn.Lsig.Sig = signer.SingleSigner.Sign(program)
		} else if len(signer.MsigSigners) > 0 {
			var pks [3]crypto.PublicKey
			for i := range signer.MsigSigners {
				pks[i] = signer.MsigSigners[i].SignatureVerifier
			}

			stxn.Txn.Sender = generateMsigAddr(pks)
			toBeSigned := logic.MultisigProgram{Addr: crypto.Digest(stxn.Txn.Sender), Program: program}

			stxn.Lsig.LMsig.Threshold = 2
			stxn.Lsig.LMsig.Version = 1
			stxn.Lsig.LMsig.Subsigs = make([]crypto.MultisigSubsig, len(pks))

			for i := range signer.MsigSigners {
				sig := signer.MsigSigners[i].Sign(toBeSigned)
				stxn.Lsig.LMsig.Subsigs[i].Key = pks[i]
				stxn.Lsig.LMsig.Subsigs[i].Sig = sig
			}

		} else {
			stxn.Txn.Sender = basics.Address(crypto.HashObj(program))
		}
	} else if signer.SingleSigner != nil {
		stxn.Txn.Sender = basics.Address(signer.SingleSigner.SignatureVerifier)
		stxn.Sig = signer.SingleSigner.Sign(stxn.Txn)
	} else if len(signer.MsigSigners) > 0 {

		var pks [3]crypto.PublicKey
		for i := range signer.MsigSigners {
			pks[i] = signer.MsigSigners[i].SignatureVerifier
		}

		stxn.Txn.Sender = generateMsigAddr(pks)

		stxn.Msig = crypto.MultisigSig{
			Version:   1,
			Threshold: 2,
			Subsigs:   make([]crypto.MultisigSubsig, len(pks)),
		}

		var sigs [][]byte
		for i := range signer.MsigSigners {
			sig := signer.MsigSigners[i].Sign(stxn.Txn)
			sigs = append(sigs, sig[:])
			stxn.Msig.Subsigs[i].Key = pks[i]
			stxn.Msig.Subsigs[i].Sig = sig
		}

	}
	stxns := make([]transactions.SignedTxn, 1)
	stxns[0] = stxn

	blkHdr := createDummyBlockHeader()
	ledger := DummyLedgerForSignature{}

	_, err = verify.TxnGroup(stxns, &blkHdr, nil, &ledger)
	if err != nil {
		panic(err)
	}

	return TxData{
		Signer:   signer,
		Stxn:     stxn,
		StxnBlob: protocol.Encode(&stxn),
		TxnBlob:  protocol.Encode(&stxn.Txn),
		Id:       stxn.Txn.ID().String(),
	}
}

type TestData struct {
	SimplePayment          TxData `codec:"simplePayment"`
	MsigPayment            TxData `codec:"msigPayment"`
	LsigPayment            TxData `codec:"lsigPayment"`
	SingleDelegatedPayment TxData `codec:"singleDelegatedPayment"`
	MsigDelegatedPayment   TxData `codec:"msigDelegatedPayment"`
}

func main() {
	secrets := generateSecrets(3)

	payFields := transactions.PaymentTxnFields{}

	simpleSigner := Signer{
		SingleSigner: secrets[0],
	}

	simplePayment := makeTxData(protocol.PaymentTx, payFields, simpleSigner)

	msigSigner := Signer{
		MsigSigners: []crypto.SignatureSecrets{*secrets[0], *secrets[1], *secrets[2]},
	}

	msigPayment := makeTxData(protocol.PaymentTx, payFields, msigSigner)

	op, err := logic.AssembleString("int 1")

	if err != nil {
		panic(err)
	}

	lsigSigner := Signer{
		Lsig: op.Program,
	}

	lsigPayment := makeTxData(protocol.PaymentTx, payFields, lsigSigner)

	delegatedSigner := Signer{
		SingleSigner: secrets[0],
		Lsig:         op.Program,
	}

	singleDelegatedPayment := makeTxData(protocol.PaymentTx, payFields, delegatedSigner)

	msigDelegatedSigner := Signer{
		MsigSigners: []crypto.SignatureSecrets{*secrets[0], *secrets[1], *secrets[2]},
		Lsig:        op.Program,
	}

	msigDelegatedPayment := makeTxData(protocol.PaymentTx, payFields, msigDelegatedSigner)

	testData := TestData{
		SimplePayment:          simplePayment,
		MsigPayment:            msigPayment,
		LsigPayment:            lsigPayment,
		SingleDelegatedPayment: singleDelegatedPayment,
		MsigDelegatedPayment:   msigDelegatedPayment,
	}

	testDataJson := protocol.EncodeJSON(&testData)
	testDataFile := "transact_test_data.json"

	err = os.WriteFile(testDataFile, testDataJson, 0644)
	if err != nil {
		panic(err)
	}
	fmt.Println("Test data written to file:", testDataFile)

}
