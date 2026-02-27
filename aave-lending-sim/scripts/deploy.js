/**
 * deploy.js
 * ---------
 * Deploys MockDIKE + MockAaveLending to the local Hardhat node.
 *
 * Run:
 *   npx hardhat node          (in one terminal)
 *   node scripts/deploy.js    (in another terminal, after node is ready)
 *
 * The script writes deployed addresses to deployed-addresses.json so the
 * frontend can read them without any manual copy-paste.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const signers = await hre.ethers.getSigners();

    const owner = signers[0];
    const strongBorrower = signers[1];
    const weakBorrower = signers[2];

    console.log("\n══════════════════════════════════════════════════");
    console.log("  Aave-Style Lending Simulation — Deploy Script");
    console.log("══════════════════════════════════════════════════");
    console.log(`Owner          : ${owner.address}`);
    console.log(`Strong Borrower: ${strongBorrower.address}`);
    console.log(`Weak   Borrower: ${weakBorrower.address}\n`);

    // ── 1. Deploy MockDIKE ───────────────────────────────────────────
    const MockDIKE = await hre.ethers.getContractFactory("MockDIKE");
    const mockDike = await MockDIKE.deploy(
        strongBorrower.address,
        weakBorrower.address
    );
    await mockDike.waitForDeployment();
    const dikeAddr = await mockDike.getAddress();
    console.log(`✓ MockDIKE deployed at       : ${dikeAddr}`);

    // ── 2. Deploy MockAaveLending ────────────────────────────────────
    const MockAaveLending = await hre.ethers.getContractFactory("MockAaveLending");
    const lending = await MockAaveLending.deploy(dikeAddr);
    await lending.waitForDeployment();
    const lendingAddr = await lending.getAddress();
    console.log(`✓ MockAaveLending deployed at: ${lendingAddr}`);

    // ── 3. Fund protocol with 10 ETH liquidity ──────────────────────
    const fundTx = await owner.sendTransaction({
        to: lendingAddr,
        value: hre.ethers.parseEther("10"),
    });
    await fundTx.wait();
    console.log(`✓ Protocol funded with 10 ETH`);

    // ── 4. Persist addresses ─────────────────────────────────────────
    const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
    const addressData = {
        MockDIKE: dikeAddr,
        MockAaveLending: lendingAddr,
        strongBorrower: strongBorrower.address,
        weakBorrower: weakBorrower.address,
        owner: owner.address,
        chainId: 31337,
        deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(outputPath, JSON.stringify(addressData, null, 2));
    console.log(`\n✓ Addresses written to deployed-addresses.json\n`);

    // Also write to frontend public directory for easy access
    const frontendPublicPath = path.join(
        __dirname,
        "..",
        "frontend",
        "public",
        "deployed-addresses.json"
    );
    fs.mkdirSync(path.dirname(frontendPublicPath), { recursive: true });
    fs.writeFileSync(frontendPublicPath, JSON.stringify(addressData, null, 2));
    console.log(`✓ Addresses also written to frontend/public/deployed-addresses.json`);

    console.log("\n══════════════════════════════════════════════════");
    console.log("  Deployment complete. Start the frontend next:");
    console.log("  cd frontend && npm run dev");
    console.log("══════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
