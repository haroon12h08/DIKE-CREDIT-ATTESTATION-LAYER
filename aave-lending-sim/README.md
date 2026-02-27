# Aave-Style DeFi Lending Simulation × DIKE

A minimal simulation of overcollateralised borrowing (Aave-style), demonstrating how DIKE on-chain credit scores reduce required collateral for qualified borrowers.

**Runs on port 3001. Does NOT touch the existing DIKE dashboard.**

---

## How DIKE Changes Underwriting

| Scenario | Without DIKE | With DIKE (Strong Borrower) | With DIKE (Weak Borrower) |
|---|---|---|---|
| Borrow 1 ETH | Requires **1.5 ETH** collateral | Requires **1.1 ETH** collateral 🎉 | Requires **1.5 ETH** collateral |
| Borrow 0.5 ETH | Requires **0.75 ETH** collateral | Requires **0.55 ETH** collateral 🎉 | Requires **0.75 ETH** collateral |

**Strong Borrower**: `onTimeCount ≥ 5` **AND** `defaultCount == 0` → Preferred 110% ratio  
**Weak Borrower**: `onTimeCount = 1`, `defaultCount = 2` → Standard 150% ratio

---

## Quick Start

### 1. Install contract dependencies

```bash
cd aave-lending-sim
npm install
```

### 2. Start local Hardhat node (Terminal 1)

```bash
npx hardhat node
```

Leave this running. It prints 20 funded test accounts.

### 3. Deploy contracts (Terminal 2)

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This:
- Deploys `MockDIKE` (hardcoded strong/weak borrower profiles for accounts[1] and accounts[2])
- Deploys `MockAaveLending` (funded with 10 ETH liquidity)
- Writes `deployed-addresses.json` and `frontend/public/deployed-addresses.json`

### 4. (Optional) Run terminal simulation

```bash
npx hardhat run scripts/simulate.js --network localhost
```

Prints the full before/after scenario comparison in the terminal.

### 5. Start the frontend (Terminal 3)

```bash
cd frontend
npm install
npm run dev
```

Open: [http://localhost:3001](http://localhost:3001)

---

## MetaMask Setup

1. Add **Hardhat Local** network to MetaMask:
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`

2. Import test accounts using the private keys printed by `npx hardhat node`:
   - **Account[0]** = Owner (can toggle DIKE)
   - **Account[1]** = Strong Borrower (benefits from DIKE)
   - **Account[2]** = Weak Borrower (standard rate always)

---

## Architecture

```
aave-lending-sim/
├── contracts/
│   ├── MockDIKE.sol          ← Mock DIKE registry (hardcoded profiles)
│   └── MockAaveLending.sol   ← Aave-style lending (DIKE-aware)
├── scripts/
│   ├── deploy.js             ← Deploy + fund contracts
│   └── simulate.js           ← Terminal before/after demo
├── frontend/                 ← Next.js, port 3001
│   └── app/page.tsx          ← Single-page UI
├── hardhat.config.js
└── package.json
```

### Smart Contract Logic

**`MockAaveLending.borrow(amount)`**:
```
IF useDIKE == false:
    requiredCollateral = amount × 150%

IF useDIKE == true:
    (_, _, defaultCount, onTimeCount, _, _, _) = DIKE.getCreditSummary(user)

    IF onTimeCount >= 5 AND defaultCount == 0:
        requiredCollateral = amount × 110%   ← DIKE preferred rate
    ELSE:
        requiredCollateral = amount × 150%   ← standard rate
```

---

## What Is NOT Implemented (by design)

- Interest accrual
- Liquidation engine
- Price oracles
- ERC-20 tokens
- Real DIKE contract integration (mocked)
- Database
- Admin dashboard
- Complex accounting / math

This is a **capital efficiency simulation only**.
