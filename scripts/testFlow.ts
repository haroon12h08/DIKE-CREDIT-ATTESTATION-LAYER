import { ethers } from "hardhat";

const REGISTRY_ADDRESS = "0x2D54be78A430792ed9ed1024f5e625C031E2ebB4";

async function main() {
    console.log(`\n--- Initiating DIKERegistry Protocol Test Flow ---`);

    const [deployer] = await ethers.getSigners();
    console.log(`Interactor Wallet: ${deployer.address}`);

    const registry = await ethers.getContractAt("DIKERegistry", REGISTRY_ADDRESS, deployer);

    // 1. Construct random mock payload
    const amount = 1000n;
    const eventType = 0; // BORROW enum index
    const referenceHash = ethers.hexlify(ethers.randomBytes(32));

    console.log(`\n[Tx] Recording new BORROW event...`);
    console.log(`     Amount: ${amount.toString()}`);
    console.log(`     Hash:   ${referenceHash}`);

    // 2. Submit Transaction
    const tx = await registry.recordEvent(
        deployer.address,
        amount,
        eventType,
        referenceHash
    );

    const receipt = await tx.wait();
    console.log(`[Tx] Confirmed in block: ${receipt?.blockNumber}`);

    console.log(`\n--- Fetching On-Chain State ---`);

    // 3. Fetch Event IDs
    const userEvents = await registry.getUserEvents(deployer.address);
    console.log(`[View] User Event IDs: [${userEvents.join(", ")}]`);

    // 4. Fetch Base64 Metadata Token Receipt
    const targetEventId = 0n;
    const tokenURI = await registry.tokenURI(targetEventId);
    console.log(`\n[View] TokenURI Receipt for ID ${targetEventId}:`);
    console.log(`${tokenURI}`);

    // 5. Fetch Credit Summary Aggregation
    const summary = await registry.getCreditSummary(deployer.address);
    console.log(`\n[View] Credit Summary:`);
    console.log(`  - Total Borrowed:   ${summary.totalBorrowed.toString()}`);
    console.log(`  - Total Repaid:     ${summary.totalRepaid.toString()}`);
    console.log(`  - Defaults:         ${summary.defaults.toString()}`);
    console.log(`  - On-Time Repays:   ${summary.onTimeRepayments.toString()}`);
    console.log(`  - Late Repays:      ${summary.lateRepayments.toString()}`);
    console.log(`  - Total Events:     ${summary.totalEvents.toString()}`);
    console.log(`  - On-Time Ratio:    ${summary.onTimeRatio.toString()}`);
    console.log(`  - Default Rate:     ${summary.defaultRate.toString()}`);

    console.log(`\n--- Test Flow Complete ---\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
