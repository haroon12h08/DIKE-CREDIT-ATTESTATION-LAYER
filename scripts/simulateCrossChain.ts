import { ethers, network } from "hardhat";

const REGISTRY_ADDRESS = "0x2D54be78A430792ed9ed1024f5e625C031E2ebB4";
const BRIDGE_ADDRESS = "0xFe6Bff2c3e228026aD4b131b13e9Ab8B3a2d2Fd9";

async function main() {
    console.log(`\n--- Initiating Cross-Chain Simulation on ${network.name} ---`);

    const [deployer] = await ethers.getSigners();
    console.log(`Interactor / Verifier: ${deployer.address}`);

    const bridge = await ethers.getContractAt("DIKEUSCBridge", BRIDGE_ADDRESS, deployer);
    const registry = await ethers.getContractAt("DIKERegistry", REGISTRY_ADDRESS, deployer);

    // 1. Construct Mock Payload representing a cross-chain origination
    const borrower = ethers.Wallet.createRandom().address; // Mock user
    const borrowAmount = 5000n;
    const repayAmount = 5000n;
    const sourceChainId = 8453; // Example: Base Network
    const sourceProtocol = "0x0000000000000000000000000000000000000001";

    const borrowTxHash = ethers.hexlify(ethers.randomBytes(32));
    const repayTxHash = ethers.hexlify(ethers.randomBytes(32));

    console.log(`\n[Tx 1] Simulating cross-chain BORROW proof submission...`);
    console.log(`       Borrower: ${borrower}`);
    console.log(`       Amount:   ${borrowAmount.toString()}`);

    const borrowTx = await bridge.verifyAndRecordBorrow(
        borrower,
        borrowAmount,
        sourceChainId,
        borrowTxHash,
        sourceProtocol
    );

    let bReceipt = await borrowTx.wait();
    console.log(`       => Confirmed in block: ${bReceipt?.blockNumber}`);

    console.log(`\n[Tx 2] Simulating cross-chain REPAYMENT proof submission...`);
    console.log(`       Amount:   ${repayAmount.toString()}`);

    const repayTx = await bridge.verifyAndRecordRepayment(
        {
            borrower: borrower,
            amount: repayAmount,
            sourceChainId: sourceChainId,
            sourceTxHash: repayTxHash,
            sourceProtocol: sourceProtocol,
            timestamp: Math.floor(Date.now() / 1000)
        }
    );

    let rReceipt = await repayTx.wait();
    console.log(`       => Confirmed in block: ${rReceipt?.blockNumber}`);

    console.log(`\n--- Fetching Settled On-Chain State from Registry ---`);

    // 3. Fetch Event IDs
    const userEvents = await registry.getUserEvents(borrower);
    console.log(`\n[View] Mints for ${borrower}:`);
    console.log(`       Total Receipts (NFTs): ${userEvents.length}`);
    console.log(`       Event IDs: [${userEvents.join(", ")}]`);

    // 4. Fetch Credit Summary
    const summary = await registry.getCreditSummary(borrower);
    console.log(`\n[View] Aggregated Credit Summary:`);
    console.log(`  - Total Borrowed:   ${summary.totalBorrowed.toString()}`);
    console.log(`  - Total Repaid:     ${summary.totalRepaid.toString()}`);
    console.log(`  - Defaults:         ${summary.defaults.toString()}`);
    console.log(`  - On-Time Repays:   ${summary.onTimeRepayments.toString()}`);
    console.log(`  - Total Events:     ${summary.totalEvents.toString()}`);

    console.log(`\n======================================`);
    if (userEvents.length === 2 && summary.totalBorrowed === summary.totalRepaid) {
        console.log(`✅ Simulation Success! Bridge mapped events onto Registry.`);
    } else {
        console.error(`❌ Simulation failed or mismatched registry mappings.`);
    }
    console.log(`======================================\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
