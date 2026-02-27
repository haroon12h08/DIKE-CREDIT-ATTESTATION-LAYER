/**
 * deploy.js — cross-chain-sim
 * -------------------------------------------
 * Deploys:
 *   MockDIKERegistry          ← global cross-chain credit ledger
 *   MockChainLending (x3)     ← Chain A (Ethereum), B (Polygon), C (BNB)
 *
 * Then seeds the registry with the "strong borrower" preset
 * (simulates history built from prior on-chain activity on Chain A).
 *
 * Run:  npm run deploy
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const W = (n) => hre.ethers.parseEther(String(n));

async function main() {
    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const strongBorrower = signers[1]; // has > 5 on-time repayments in registry
    const weakBorrower = signers[2]; // has defaults

    console.log("\n══════════════════════════════════════════════════");
    console.log("  Cross-Chain Lending Simulation — Deploy");
    console.log("══════════════════════════════════════════════════");
    console.log(`Owner          : ${owner.address}`);
    console.log(`Strong Borrower: ${strongBorrower.address}`);
    console.log(`Weak   Borrower: ${weakBorrower.address}\n`);

    // ── 1. Deploy Global Registry ──────────────────────────────────
    const Registry = await hre.ethers.getContractFactory("MockDIKERegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const regAddr = await registry.getAddress();
    console.log(`✓ MockDIKERegistry deployed at: ${regAddr}`);

    // ── 2. Deploy per-chain lending contracts ──────────────────────
    const Lending = await hre.ethers.getContractFactory("MockChainLending");

    const chainA = await Lending.deploy("Chain A (Ethereum)", regAddr);
    await chainA.waitForDeployment();
    const chainAAddr = await chainA.getAddress();
    console.log(`✓ Chain A deployed at: ${chainAAddr}`);

    const chainB = await Lending.deploy("Chain B (Polygon)", regAddr);
    await chainB.waitForDeployment();
    const chainBAddr = await chainB.getAddress();
    console.log(`✓ Chain B deployed at: ${chainBAddr}`);

    const chainC = await Lending.deploy("Chain C (BNB)", regAddr);
    await chainC.waitForDeployment();
    const chainCAddr = await chainC.getAddress();
    console.log(`✓ Chain C deployed at: ${chainCAddr}`);

    // ── 3. Preset registry profiles ───────────────────────────────
    // Strong borrower: 10 on-time repayments from prior Chain A activity
    // (simulates history built before this demo session)
    await registry.connect(owner).setProfile(
        strongBorrower.address,
        W("10"),   // totalBorrowed
        W("10"),   // totalRepaid
        0,         // defaultCount
        10,        // onTimeCount  ✓
        0          // lateCount
    );
    console.log(`\n✓ Strong borrower preset: onTime=10, defaults=0`);

    // Weak borrower: poor history
    await registry.connect(owner).setProfile(
        weakBorrower.address,
        W("5"),    // totalBorrowed
        W("2"),    // totalRepaid
        2,         // defaultCount  ✗
        1,         // onTimeCount
        1          // lateCount
    );
    console.log(`✓ Weak borrower preset:   onTime=1,  defaults=2`);

    // ── 4. Persist addresses ───────────────────────────────────────
    const data = {
        MockDIKERegistry: regAddr,
        chainA: chainAAddr,
        chainB: chainBAddr,
        chainC: chainCAddr,
        strongBorrower: strongBorrower.address,
        weakBorrower: weakBorrower.address,
        owner: owner.address,
        chainId: 31337,
        deployedAt: new Date().toISOString(),
    };

    const rootOut = path.join(__dirname, "..", "deployed-addresses.json");
    fs.writeFileSync(rootOut, JSON.stringify(data, null, 2));
    console.log(`\n✓ deployed-addresses.json written`);

    const frontendPublic = path.join(__dirname, "..", "frontend", "public", "deployed-addresses.json");
    fs.mkdirSync(path.dirname(frontendPublic), { recursive: true });
    fs.writeFileSync(frontendPublic, JSON.stringify(data, null, 2));
    console.log(`✓ frontend/public/deployed-addresses.json written`);

    console.log("\n══════════════════════════════════════════════════");
    console.log("  Deployment complete. Start frontend:");
    console.log("  cd frontend && node_modules/.bin/next dev -p 3003");
    console.log("══════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
