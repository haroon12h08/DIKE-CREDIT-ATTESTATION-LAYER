/**
 * deploy.js  — rwa-lending-sim
 * --------------------------------
 * Deploys MockDIKE + MockRWAPool to the local Hardhat node,
 * funds the pool with 10 ETH from the owner, and writes
 * deployed-addresses.json to both project root and frontend/public/.
 *
 * Run:
 *   npx hardhat --config hardhat.config.js node          (Terminal 1)
 *   npm run deploy                                        (Terminal 2)
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const strongBorrower = signers[1];
    const weakBorrower = signers[2];
    const investor = signers[3];

    console.log("\n══════════════════════════════════════════════════");
    console.log("  RWA Lending Pool Simulation — Deploy Script");
    console.log("══════════════════════════════════════════════════");
    console.log(`Owner          : ${owner.address}`);
    console.log(`Strong Borrower: ${strongBorrower.address}`);
    console.log(`Weak   Borrower: ${weakBorrower.address}`);
    console.log(`Investor       : ${investor.address}\n`);

    // ── 1. Deploy MockDIKE ─────────────────────────────────────────
    const MockDIKE = await hre.ethers.getContractFactory("MockDIKE");
    const mockDike = await MockDIKE.deploy(
        strongBorrower.address,
        weakBorrower.address
    );
    await mockDike.waitForDeployment();
    const dikeAddr = await mockDike.getAddress();
    console.log(`✓ MockDIKE deployed at   : ${dikeAddr}`);

    // ── 2. Deploy MockRWAPool ──────────────────────────────────────
    const MockRWAPool = await hre.ethers.getContractFactory("MockRWAPool");
    const pool = await MockRWAPool.deploy(dikeAddr);
    await pool.waitForDeployment();
    const poolAddr = await pool.getAddress();
    console.log(`✓ MockRWAPool deployed at: ${poolAddr}`);

    // ── 3. Seed pool via investor (5 ETH) ─────────────────────────
    const seedTx = await pool.connect(investor).invest({
        value: hre.ethers.parseEther("5"),
    });
    await seedTx.wait();
    const liquidity = await pool.totalPoolLiquidity();
    console.log(`✓ Pool seeded with 5 ETH by investor`);
    console.log(`  Pool liquidity: ${hre.ethers.formatEther(liquidity)} ETH`);

    // ── 4. Write addresses ─────────────────────────────────────────
    const addressData = {
        MockDIKE: dikeAddr,
        MockRWAPool: poolAddr,
        strongBorrower: strongBorrower.address,
        weakBorrower: weakBorrower.address,
        investor: investor.address,
        owner: owner.address,
        chainId: 31337,
        deployedAt: new Date().toISOString(),
    };

    const rootOut = path.join(__dirname, "..", "deployed-addresses.json");
    fs.writeFileSync(rootOut, JSON.stringify(addressData, null, 2));
    console.log(`\n✓ Addresses written to deployed-addresses.json`);

    const frontendPublic = path.join(
        __dirname, "..", "frontend", "public", "deployed-addresses.json"
    );
    fs.mkdirSync(path.dirname(frontendPublic), { recursive: true });
    fs.writeFileSync(frontendPublic, JSON.stringify(addressData, null, 2));
    console.log(`✓ Addresses written to frontend/public/deployed-addresses.json`);

    console.log("\n══════════════════════════════════════════════════");
    console.log("  Deployment complete. Start the frontend:");
    console.log("  cd frontend && node_modules/.bin/next dev -p 3002");
    console.log("══════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
