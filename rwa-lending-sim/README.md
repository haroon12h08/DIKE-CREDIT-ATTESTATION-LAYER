# RWA Lending Pool Simulation × DIKE

Minimal RWA-style uncollateralized lending pool simulation on **port 3002**.  
Does NOT touch any existing DIKE codebase.

---

## How DIKE Changes Underwriting

| Scenario | Without DIKE | With DIKE |
|---|---|---|
| Strong Borrower (onTime≥5, defaults=0) | Manual approval — opaque | **Auto-APPROVED instantly** ✓ |
| Weak Borrower (onTime=1, defaults=2) | Manual approval — looks same! | **Auto-REJECTED** ✗ |

**Without DIKE** → admin approves subjectively with no credit visibility  
**With DIKE** → standardised, performance-based, automatic screening

Repayment = principal × 110% (simulates 10% fixed yield). No real interest logic.

---

## Quick Start

### 1. Install Hardhat deps
```bash
cd rwa-lending-sim
npm install
```

### 2. Start local Hardhat node (Terminal 1)
```bash
npm run node
```

### 3. Deploy contracts (Terminal 2)
```bash
npm run deploy
# optional: npm run simulate
```

### 4. Start frontend (Terminal 3)
```bash
cd frontend
node_modules/.bin/next dev -p 3002
```
Open: [http://localhost:3002](http://localhost:3002)

---

## MetaMask Setup

Network: RPC `http://127.0.0.1:8545`, Chain ID `31337`

| Account | Role |
|---|---|
| Account[0] | Owner — can Toggle DIKE |
| Account[1] | Strong Borrower — onTime=10, defaults=0 |
| Account[2] | Weak Borrower — onTime=1, defaults=2 |
| Account[3] | Investor |

---

## Demo Narrative

1. Connect as **Account[3] (Investor)** → click **Invest 5 ETH**
2. Connect as **Account[2] (Weak Borrower)** → **Request 3 ETH Loan**
3. Connect as **Account[0] (Owner)** → **Approve Loan** (manual, no credit data)
4. As Account[2] → **Withdraw Loan** → **Repay 1 ETH** × 4
5. As **Account[0]** → click **Enable DIKE**
6. Connect as **Account[1] (Strong Borrower)** → **Request 3 ETH Loan**
7. As **Account[0]** → **Approve Loan (DIKE auto)** → **Auto-APPROVED ✓**
8. Connect as **Account[2] (Weak Borrower)** → **Request 3 ETH Loan**
9. As **Account[0]** → **Approve Loan (DIKE auto)** → **Auto-REJECTED ✗**

---

## Architecture

```
rwa-lending-sim/
├── contracts/
│   ├── MockDIKE.sol       ← Mock DIKE registry (hardcoded profiles)
│   └── MockRWAPool.sol    ← Core RWA pool contract
├── scripts/
│   ├── deploy.js          ← Deploy + seed 5 ETH
│   └── simulate.js        ← Full narrative demo in terminal
├── frontend/              ← Next.js, port 3002
│   └── app/page.tsx       ← Single-page UI
├── hardhat.config.js
└── package.json
```

### approveLoan() Logic

```
IF useDIKE == false:
    Only owner can approve   ← opaque, manual, subjective

IF useDIKE == true:
    (_, _, defaultCount, onTimeCount, _, _, _) = DIKE.getCreditSummary(borrower)
    IF onTimeCount >= 5 AND defaultCount == 0:
        Auto-APPROVE ✓
    ELSE:
        Auto-REJECT  ✗
```

---

## What Is NOT Implemented

- No KYC, no real-world data
- No oracle or price feeds
- No tranche structuring
- No ERC-20 LP tokens
- No yield distribution
- No complex accounting
- This is a **simulation only**
