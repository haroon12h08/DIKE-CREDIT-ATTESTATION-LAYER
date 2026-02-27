# Cross-Chain Lending Simulation × DIKE

Simulates how on-chain reputation is siloed per-chain — and how DIKE solves it.  
Runs on **port 3003**. Does NOT touch any existing DIKE codebase.

---

## The Problem: Reputation Fragmentation

Without DIKE, each chain tracks credit independently:

| Chain | Strong Borrower (10 on-time) | Weak Borrower |
|---|---|---|
| Chain A (Ethereum) | 150% collateral | 150% collateral |
| Chain B (Polygon) | **150%** (sees nothing!) | 150% collateral |
| Chain C (BNB) | **150%** (sees nothing!) | 150% collateral |

The strong borrower's history **cannot cross chain boundaries**.

## The Solution: DIKE as Universal Registry

With DIKE enabled, every chain queries the same global ledger:

| Chain | Strong Borrower | Weak Borrower |
|---|---|---|
| Chain A (Ethereum) | **120%** ✓ | 150% |
| Chain B (Polygon) | **120%** ✓ | 150% |
| Chain C (BNB) | **120%** ✓ | 150% |

**Ratio logic**: onTimeCount ≥ 5 AND defaultCount == 0 → 120%, else → 150%

---

## Quick Start

### 1. Install deps
```bash
cd cross-chain-sim
npm install   # or: symlink from aave-lending-sim/node_modules
```

### 2. Start Hardhat node (Terminal 1)
```bash
npm run node
```

### 3. Deploy (Terminal 2)
```bash
npm run deploy
npm run simulate   # optional terminal demo
```

### 4. Frontend on port 3003 (Terminal 3)
```bash
cd frontend
node_modules/.bin/next dev -p 3003
```

---

## MetaMask Accounts

| Account | Role |
|---|---|
| Account[0] | Owner — toggles DIKE on all chains |
| Account[1] | Strong Borrower — onTime=10, defaults=0, gets 120% |
| Account[2] | Weak Borrower — onTime=1, defaults=2, stays at 150% |

---

## Contracts

| Contract | Description |
|---|---|
| `MockDIKERegistry.sol` | Global cross-chain credit ledger (aggregates all chains) |
| `MockChainLending.sol` | Deployed 3x for Chain A/B/C, queries registry when DIKE on |

---

## What Is NOT Built

No real bridges · No LayerZero · No oracle · No ERC-20 · No liquidation.  
This is a **reputation visibility simulation only**.
