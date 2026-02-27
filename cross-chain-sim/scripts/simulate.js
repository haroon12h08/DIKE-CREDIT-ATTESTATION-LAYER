/**
 * simulate.js — cross-chain-sim
 * ----------------------------------------
 * Full narrative demonstration:
 *
 *   Phase 1 — WITHOUT DIKE (reputation silos)
 *     Strong borrower repays 5x on Chain A
 *     Chain B sees nothing → 150% ratio
 *
 *   Phase 2 — WITH DIKE (portable reputation)
 *     Enable DIKE on all chains
 *     Chain B recognises Chain A history → 120% ratio
 *     Chain C also benefits immediately
 *     Weak borrower stays at 150% everywhere
 *
 * Run: npm run simulate
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const W = (n) => hre.ethers.parseEther(String(n));
const E = (n) => hre.ethers.formatEther(n);

async function main() {
    const addrFile = path.join(__dirname, "..", "deployed-addresses.json");
    if (!fs.existsSync(addrFile)) {
        throw new Error("Run `npm run deploy` first.");
    }
    const addrs = JSON.parse(fs.readFileSync(addrFile, "utf8"));
    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const strongBorrower = signers[1];
    const weakBorrower = signers[2];

    const chainA = await hre.ethers.getContractAt("MockChainLending", addrs.chainA, owner);
    const chainB = await hre.ethers.getContractAt("MockChainLending", addrs.chainB, owner);
    const chainC = await hre.ethers.getContractAt("MockChainLending", addrs.chainC, owner);

    async function printRatios(label) {
        const [rAS, rBS, rCS] = await Promise.all([
            chainA.getRequiredRatioFor(strongBorrower.address),
            chainB.getRequiredRatioFor(strongBorrower.address),
            chainC.getRequiredRatioFor(strongBorrower.address),
        ]);
        const [rAW, rBW, rCW] = await Promise.all([
            chainA.getRequiredRatioFor(weakBorrower.address),
            chainB.getRequiredRatioFor(weakBorrower.address),
            chainC.getRequiredRatioFor(weakBorrower.address),
        ]);
        console.log(`\n  ── ${label} ──`);
        console.log(`  ┌───────────────┬──────────────┬──────────────┐`);
        console.log(`  │               │ Strong (10/0) │ Weak   (1/2) │`);
        console.log(`  ├───────────────┼──────────────┼──────────────┤`);
        console.log(`  │ Chain A (ETH) │     ${rAS}%       │     ${rAW}%      │`);
        console.log(`  │ Chain B (POL) │     ${rBS}%       │     ${rBW}%      │`);
        console.log(`  │ Chain C (BNB) │     ${rCS}%       │     ${rCW}%      │`);
        console.log(`  └───────────────┴──────────────┴──────────────┘`);
    }

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  Cross-Chain Lending — Reputation Portability Demo");
    console.log("══════════════════════════════════════════════════════════");

    // ════════════════════════════════════════════════════════════════
    // PHASE 1 — WITHOUT DIKE
    // ════════════════════════════════════════════════════════════════
    console.log("\n┌────────────────────────────────────────────────┐");
    console.log("│  PHASE 1: Without DIKE — Reputation Silos      │");
    console.log("└────────────────────────────────────────────────┘");

    await printRatios("All chains without DIKE");
    console.log("\n  → Strong borrower has 10 successful repayments on Chain A.");
    console.log("    But Chains B & C have NO visibility → both still at 150%.");
    console.log("    Reputation is TRAPPED in silos.\n");

    // Demonstrate: strong borrower borrows + repays 5x on Chain A (local)
    console.log("  Simulating 5x borrow/repay cycle on Chain A (no DIKE)…");
    for (let i = 1; i <= 5; i++) {
        await (await chainA.connect(strongBorrower).borrow(W("1"))).wait();
        await (await chainA.connect(strongBorrower).repay(W("1"))).wait();
        process.stdout.write(`  ✓ Chain A cycle ${i}/5\r`);
    }
    console.log("  ✓ 5 borrow/repay cycles on Chain A completed      ");

    const localBorr = await chainA.localBorrowed(strongBorrower.address);
    const localRepa = await chainA.localRepaid(strongBorrower.address);
    console.log(`\n  Chain A local history: borrowed=${E(localBorr)} ETH, repaid=${E(localRepa)} ETH`);

    // Chain B still knows nothing
    const localBorrB = await chainB.localBorrowed(strongBorrower.address);
    console.log(`  Chain B local history: borrowed=${E(localBorrB)} ETH (INVISIBLE)`);

    await printRatios("Ratios after local Chain A activity (DIKE still off)");

    // ════════════════════════════════════════════════════════════════
    // PHASE 2 — WITH DIKE
    // ════════════════════════════════════════════════════════════════
    console.log("\n┌────────────────────────────────────────────────┐");
    console.log("│  PHASE 2: With DIKE — Portable Reputation       │");
    console.log("└────────────────────────────────────────────────┘");

    // Enable DIKE on all three chains
    await (await chainA.connect(owner).toggleDIKE(true)).wait();
    await (await chainB.connect(owner).toggleDIKE(true)).wait();
    await (await chainC.connect(owner).toggleDIKE(true)).wait();
    console.log("\n  DIKE enabled on Chain A, B, and C.\n");

    await printRatios("Ratios AFTER DIKE enabled");
    console.log("\n  → Strong borrower's Chain A history is now VISIBLE on B & C.");
    console.log("    Ratio drops to 120% on all chains instantly.");
    console.log("    Weak borrower remains at 150% everywhere.\n");

    // ── Summary ───────────────────────────────────────────────────
    console.log("══════════════════════════════════════════════════════════");
    console.log("  FINAL SUMMARY");
    console.log("══════════════════════════════════════════════════════════");
    console.log("                      WITHOUT DIKE        WITH DIKE");
    console.log("  Chain B (Strong)       150%         →    120% ✓");
    console.log("  Chain C (Strong)       150%         →    120% ✓");
    console.log("  Chain B (Weak)         150%         →    150%");
    console.log("  Chain C (Weak)         150%         →    150%");
    console.log("\n  DIKE collapses reputation silos.");
    console.log("  Credit history becomes chain-agnostic infrastructure.");
    console.log("\n  Simulation complete. ✓");
    console.log("══════════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
