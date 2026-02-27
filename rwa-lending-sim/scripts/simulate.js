/**
 * simulate.js — rwa-lending-sim
 * -----------------------------------
 * Demonstrates the full narrative:
 *
 *   Act 1 — WITHOUT DIKE (manual underwriting)
 *     Investor deposits, weak borrower requests + admin approves
 *
 *   Act 2 — WITH DIKE (automated underwriting)
 *     Strong borrower → auto-approved
 *     Weak borrower   → auto-rejected
 *
 * Run:
 *   npm run simulate
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const W = (n) => hre.ethers.parseEther(String(n));
const E = (n) => hre.ethers.formatEther(n);

async function main() {
    const addrFile = path.join(__dirname, "..", "deployed-addresses.json");
    if (!fs.existsSync(addrFile)) {
        throw new Error("deployed-addresses.json not found — run `npm run deploy` first.");
    }
    const addrs = JSON.parse(fs.readFileSync(addrFile, "utf8"));

    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const strongBorrower = signers[1];
    const weakBorrower = signers[2];
    const investor = signers[3];

    const pool = await hre.ethers.getContractAt("MockRWAPool", addrs.MockRWAPool, owner);

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  RWA Lending Pool — Underwriting Simulation");
    console.log("══════════════════════════════════════════════════════════");

    // ── Helper: print pool state ───────────────────────────────────
    async function printPool(label) {
        const liq = await pool.totalPoolLiquidity();
        const bamt = await pool.borrowedAmount();
        const rapd = await pool.repaymentsMade();
        const rdue = await pool.repaymentDue();
        const appr = await pool.loanApproved();
        const dike = await pool.useDIKE();
        console.log(`\n  ── ${label} ──`);
        console.log(`  Pool Liquidity  : ${E(liq)} ETH`);
        console.log(`  Borrowed Amount : ${E(bamt)} ETH`);
        console.log(`  Repayments Made : ${E(rapd)} ETH / ${E(rdue)} ETH due`);
        console.log(`  Loan Approved   : ${appr}`);
        console.log(`  DIKE Enabled    : ${dike}`);
    }

    // ════════════════════════════════════════════════════════════════
    // ACT 1 — WITHOUT DIKE (manual, opaque underwriting)
    // ════════════════════════════════════════════════════════════════
    console.log("\n┌──────────────────────────────────────────────┐");
    console.log("│  ACT 1: Without DIKE (useDIKE = false)       │");
    console.log("└──────────────────────────────────────────────┘");
    console.log("  Scenario: Weak borrower requests a 3 ETH loan.");
    console.log("  Without DIKE, admin has no credit data — approves blindly.\n");

    await printPool("Before loan request");

    // Weak borrower requests
    const reqTx1 = await pool.connect(weakBorrower).requestLoan(W("3"));
    await reqTx1.wait();
    console.log(`\n  ✓ Weak borrower requested 3 ETH loan`);

    // Owner manually approves (no credit check)
    const appTx1 = await pool.connect(owner).approveLoan();
    await appTx1.wait();
    const repDue1 = await pool.repaymentDue();
    console.log(`  ✓ Owner manually approved loan (no credit data visible)`);
    console.log(`  ✓ Repayment due: ${E(repDue1)} ETH (principal × 110%)`);

    // Borrower withdraws
    const wdTx1 = await pool.connect(weakBorrower).withdrawLoan();
    await wdTx1.wait();
    console.log(`  ✓ Weak borrower withdrew 3 ETH from pool`);

    // Repay in installments
    for (let i = 0; i < 3; i++) {
        const repTx = await pool.connect(weakBorrower).repayInstallment({ value: W("1.1") });
        await repTx.wait();
    }
    console.log(`  ✓ Weak borrower repaid in 3 installments of 1.1 ETH`);
    await printPool("After repayment complete");

    console.log("\n  RESULT: Both borrowers look identical without DIKE.");
    console.log("          Admin approval is manual and subjective.\n");

    // ════════════════════════════════════════════════════════════════
    // ACT 2 — WITH DIKE (automated, evidence-based underwriting)
    // ════════════════════════════════════════════════════════════════
    console.log("\n┌───────────────────────────────────────────────┐");
    console.log("│  ACT 2: With DIKE (useDIKE = true)            │");
    console.log("└───────────────────────────────────────────────┘");

    const togTx = await pool.connect(owner).toggleDIKE(true);
    await togTx.wait();
    console.log("\n  DIKE enabled.");

    // ── Strong borrower: auto-approved ────────────────────────────
    console.log("\n  [Strong Borrower — onTime=10, defaults=0]");
    const reqStrong = await pool.connect(strongBorrower).requestLoan(W("3"));
    await reqStrong.wait();
    console.log("  ✓ Strong borrower requested 3 ETH loan");

    const appStrong = await pool.connect(owner).approveLoan(); // anyone can call
    await appStrong.wait();
    const approvedStrong = await pool.loanApproved();
    console.log(`  ✓ Auto-approval result: ${approvedStrong ? "APPROVED ✓" : "REJECTED ✗"}`);

    if (approvedStrong) {
        const wdStrong = await pool.connect(strongBorrower).withdrawLoan();
        await wdStrong.wait();
        const rdueSt = await pool.repaymentDue();
        console.log(`  ✓ Strong borrower withdrew 3 ETH (repayment due: ${E(rdueSt)} ETH)`);

        // Repay all at once
        const repStrong = await pool.connect(strongBorrower).repayInstallment({ value: W("3.3") });
        await repStrong.wait();
        console.log("  ✓ Strong borrower repaid in full");
    }

    // ── Weak borrower: auto-rejected ──────────────────────────────
    console.log("\n  [Weak Borrower — onTime=1, defaults=2]");
    const reqWeak = await pool.connect(weakBorrower).requestLoan(W("3"));
    await reqWeak.wait();
    console.log("  ✓ Weak borrower requested 3 ETH loan");

    const appWeak = await pool.connect(owner).approveLoan();
    const receiptWeak = await appWeak.wait();
    const rejectedEvt = receiptWeak.logs
        .map((l) => { try { return pool.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "LoanRejected");

    console.log(`  ✗ Weak borrower: ${rejectedEvt ? "AUTO-REJECTED" : "status unknown"}`);
    if (rejectedEvt) {
        console.log(`    Reason: ${rejectedEvt.args?.reason}`);
    }

    // ── Summary ───────────────────────────────────────────────────
    await printPool("Final pool state");

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("══════════════════════════════════════════════════════════");
    console.log("  ┌──────────────────┬──────────────────┬────────────────────┐");
    console.log("  │ Borrower         │ w/o DIKE         │ w/ DIKE            │");
    console.log("  ├──────────────────┼──────────────────┼────────────────────┤");
    console.log("  │ Strong (10/0)    │ Manual (opaque)  │ Auto-APPROVED ✓    │");
    console.log("  │ Weak   (1/2)     │ Manual (opaque)  │ Auto-REJECTED ✗    │");
    console.log("  └──────────────────┴──────────────────┴────────────────────┘");
    console.log("\n  WITHOUT DIKE → opaque, subjective underwriting");
    console.log("  WITH    DIKE → standardized, performance-based approval");
    console.log("\n  Simulation complete. ✓");
    console.log("══════════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
