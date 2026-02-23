# DIKE Cross-Chain Architecture

DIKE is a decentralized credit attestation infrastructure that normalizes lending activities from any EVM chain into canonical NFTs and aggregated on-chain credit scores on the Creditcoin network.

## 1. Mock Protocol (Source Chain)
A standard lending protocol (e.g., Sepolia) that handles capital distribution and repayment. It emits `Borrow` and `Repay` events containing loan metrics, sender addresses, and block timestamps.

## 2. Relayer (Off-Chain Daemon)
A Node.js backend indexing daemon that polls the source chain for MockProtocol lending events. It normalizes all token sizes locally to a strict `1e18` scale. It generates verifiable JSON proofs mappings and relays the structured payloads to the Bridge contract on Creditcoin.

## 3. Bridge Layer (Creditcoin)
The `DIKEUSCBridge.sol` contract serves as the active proxy verification gatekeeping Creditcoin. It prevents transaction replays via strict deterministic hash matching, enforces admin state (Pausable/Ownable), and natively triggers the Registry upon correct payload validation.

## 4. Registry Layer (Creditcoin)
The core `DIKERegistry.sol` storage contract. It enforces strict hash-based deduplication (`usedReferences`), safely aggregates math down to zero `outstandingDebt`, and scales dynamic fraction statistics (`defaultRate`, `onTimeRatio`) across bounded Ethereum integers.

## 5. NFT Issuance
Every successfully bridged event natively mints a sequentially incremented ERC721 Token via `DIKERegistry`. Token metadata encodes the payload size, the human-readable string mapping of the Event Enum type, and the transaction hash origin in Base64 JSON.

## 6. Aggregation Logic
The Registry maintains internal `UserTotals` and `SystemTotals` structs caching live nominal values without recalculation loops. Reading operations calculate fractional limits securely against 0-divides, strictly casting bounded totals upward.

---

### Data Flow

```text
+-------------------+       Event Emmission       +-------------------+
|                   |  Borrow/Repay (Raw)         |                   |
| Mock Protocol     | --------------------------> | Cross-Chain       |
| (Sepolia Testnet) |                             | Relayer (Node.js) |
|                   |                             |                   |
+-------------------+                             +-------------------+
                                                            |
                                                            |  Normalize to 1e18
                                                            |  Generate Proof Hash
                                                            |  Off-Chain Polling
                                                            v
+-------------------+       State Emits NFT       +-------------------+
|                   |                             |                   |
| DIKE Registry     | <-------------------------- | DIKE USC Bridge   |
| (Creditcoin Node) |     Trigger recordEvent()   | (Creditcoin Node) |
|                   |                             |                   |
+-------------------+                             +-------------------+
```
