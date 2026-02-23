# DIKE Test Matrix

## 1. Contract Unit Tests (`DIKERegistry.test.ts`)
- **`recordEvent`**: Validates structural constraints (non-zero subject, non-zero amount). Enforces `referenceHash` mapping for duplicate prevention. Verifies NFT state minting and internal event tracking.
- **`getCreditSummary`**: Validates cumulative aggregation math (totals) and precise `1e18` scale conversion for ratio calculations (`onTimeRatio`, `defaultRate`).
- **`getOutstandingDebt`**: Verifies dynamic difference calculations. Ensures state safely floors to zero when `totalRepaid > totalBorrowed`.
- **`tokenURI`**: Ensures strict sequential boundaries, reverting absent tokens. Validates base64 string correctness and validates Enum-to-String conversions (`"BORROW"`, `"REPAY_ON_TIME"`).
- **`usedReferences`**: Checks `mapping(bytes32 => bool)` state updates across atomic minting cycles.

## 2. Bridge Unit Tests (`DIKEUSCBridge.test.ts`)
- **`Constructor`**: Reverts on `address(0)` initialization.
- **`verifyAndRecordBorrow`**: Enforces strict payload mapping. Validates event emission (`BorrowVerified`) and processes internal registry calls.
- **`verifyAndRecordRepayment`**: Validates normalized amount structures. Confirms event mapping emission (`RepaymentVerified`).
- **`processedProofs`**: Tests transaction hash replay protection bounds across both borrow and repayment flows.

## 3. Integration Tests (`integration.test.ts`)
- **E2E Simulation**: Executes a fully isolated Hardhat environment without external RPC dependencies.
- **Dependency Map**: Deploys `MockToken`, `MockLendingProtocol`, `DIKERegistry`, and `DIKEUSCBridge`.
- **Flow Validation**: 
  - Simulates active `Borrow` and `Repay` actions via MockProtocol.
  - Forces cross-chain proof routing into the Bridge.
  - Verifies exact end-state synchronization: `2` NFTs minted, matched scaled balances (`100` total, `0` outstanding), and precise event iteration constraints (`eventCount`).
- **Invariant Hooks**: Enforces the global constraints (`totalRepaid <= totalBorrowed + lateRepaymentsAmount`, `eventCount == userEventIds.length`, `NFT supply == nextEventId`).

## 4. Edge Cases Covered
- Attempting to pass `0` explicitly into monetary values across Bridge and Registry nodes.
- Attempting to query token URIs before minting boundaries.
- Attempting to transfer ownership to uninitialized addresses.
- Negative arithmetic handling in `getOutstandingDebt` when repayment overrides base liability.

## 5. Attack Vectors Considered
- **Double-Minting Attacks**: Addressed natively via the strict `usedReferences` hash requirements.
- **Cross-Chain Replays**: Addressed natively via the `processedProofs` hash storage locally on the Bridge execution.
- **Zero-Value Inflation**: Access rules and variable type checks strictly ban zero-mint event flooding.
- **Unauthorized Minting**: Functions are strictly locked beneath `OnlyOwner` access modifiers on the Registry side.

## 6. Replay Protection Validation
- Tested via explicit identical hash injection attempts against both the Registry `referenceHash` mappings and the Bridge `processedProofs` mappings. Expected state enforces `RevertedWithCustomError` or standard string reverts instantly.

## 7. Amount Normalization Validation
- Verified exclusively relying on `1e18` fixed mapping scales globally. Total event aggregation strictly respects Ethereum unit boundaries as opposed to relative nominal numeric drift.

## 8. Ownership & Access Control
- Extensively audited via `connect(nonOwner)`. All state-mutating access limits (Minting, Pausing, Transferring Ownership) natively enforce `OwnableUnauthorizedAccount` bounds.

## 9. Pausable Behavior
- Validated via `Pausable` hooks. Verified state injections properly freeze (`EnforcedPause` revert) on verification commands when paused by an admin, and unfreeze upon unpausing.

## 10. Known Limitations
- The integration test simulates cross-chain execution locally via forced hash extraction rather than relying directly upon the actual node daemon syncing data async.
- The `timestamp` property on events is loosely scoped and currently serves as a purely historic off-chain indicator, not actively constrained by on-chain expiry limits.
