import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Contract Artifact ABIs
const MockLendingProtocolArtifact = require("../artifacts/contracts/MockLendingProtocol.sol/MockLendingProtocol.json");
const MockTokenArtifact = require("../artifacts/contracts/MockToken.sol/MockToken.json");
const DIKERegistryArtifact = require("../artifacts/contracts/DIKERegistry.sol/DIKERegistry.json");

// Environment Variables
const SEPOLIA_RPC = process.env.SEPOLIA_RPC;
const CREDITCOIN_RPC = process.env.CREDITCOIN_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!SEPOLIA_RPC || !CREDITCOIN_RPC || !PRIVATE_KEY) {
    throw new Error("Missing required environment variables: SEPOLIA_RPC, CREDITCOIN_RPC, or PRIVATE_KEY");
}

// Target Contract Addresses
const MOCK_LENDING_PROTOCOL_ADDRESS = "0x75375cF67A3D208dc5587f0B069038eaFb9803a8";
const MOCK_TOKEN_ADDRESS = "0xa194558f68f69eAaA8bbb55700D408349663E57C";
const DIKE_REGISTRY_ADDRESS = "0xa194558f68f69eAaA8bbb55700D408349663E57C";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForRegistryEventCount(registry: ethers.Contract, user: string, targetCount: number) {
    console.log(`⏳ Waiting for Relayer to bridge event to Registry (target: ${targetCount} events)...`);
    while (true) {
        const events = await registry.getUserEvents(user);
        if (events.length >= targetCount) {
            console.log(`✅ Registry updated! Found ${events.length} events.`);
            return events;
        }
        await sleep(5000); // Poll every 5 seconds
    }
}

async function main() {
    // 1. Initialize Providers
    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const creditcoinProvider = new ethers.JsonRpcProvider(CREDITCOIN_RPC);

    // 2. Initialize Wallets tied to their respective chains
    const sepoliaWallet = new ethers.Wallet(PRIVATE_KEY as string, sepoliaProvider);
    const creditcoinWallet = new ethers.Wallet(PRIVATE_KEY as string, creditcoinProvider);

    // 3. Initialize Contract Instances
    const protocol = new ethers.Contract(MOCK_LENDING_PROTOCOL_ADDRESS, MockLendingProtocolArtifact.abi, sepoliaWallet);
    const token = new ethers.Contract(MOCK_TOKEN_ADDRESS, MockTokenArtifact.abi, sepoliaWallet);
    const registry = new ethers.Contract(DIKE_REGISTRY_ADDRESS, DIKERegistryArtifact.abi, creditcoinWallet);

    const borrowerAddress = sepoliaWallet.address;
    console.log(`\nStarting Demo Flow for User: ${borrowerAddress}`);

    const initialEvents = await registry.getUserEvents(borrowerAddress);
    const initialCount = initialEvents.length;
    console.log(`Initial Creditcoin Event Count: ${initialCount}`);

    // --- Step 1. Borrow on Sepolia ---
    console.log(`\n--- 1. Borrowing on Sepolia ---`);
    const borrowAmount = ethers.parseUnits("100", 18);
    const borrowTx = await protocol.borrow(borrowAmount);
    const borrowReceipt = await borrowTx.wait();
    console.log(`✅ Borrow tx confirmed on Sepolia: ${borrowReceipt.hash}`);

    let loanId;
    for (const log of borrowReceipt.logs) {
        try {
            const parsed = protocol.interface.parseLog(log);
            if (parsed && parsed.name === "LoanBorrowed") {
                loanId = parsed.args.loanId; // struct mappings available by name in ethers v6
            }
        } catch (e) { }
    }

    if (loanId === undefined) {
        throw new Error("Could not find LoanBorrowed event to extract loanId.");
    }
    console.log(`Extracted Loan ID: ${loanId.toString()}`);

    // --- Step 2. Wait for relayer to detect borrow ---
    console.log(`\n--- 2. Waiting for Relayer (Borrow) ---`);
    const eventsAfterBorrow = await waitForRegistryEventCount(registry, borrowerAddress, initialCount + 1);

    // --- Step 3. Repay on Sepolia ---
    console.log(`\n--- 3. Repaying on Sepolia ---`);
    console.log(`Approving MockToken for repayment...`);
    const approveTx = await token.approve(MOCK_LENDING_PROTOCOL_ADDRESS, borrowAmount);
    await approveTx.wait();

    console.log(`Executing repay...`);
    const repayTx = await protocol.repay(loanId);
    const repayReceipt = await repayTx.wait();
    console.log(`✅ Repay tx confirmed on Sepolia: ${repayReceipt.hash}`);

    // --- Step 4. Wait for relayer to detect repayment ---
    console.log(`\n--- 4. Waiting for Relayer (Repayment) ---`);
    const eventsAfterRepay = await waitForRegistryEventCount(registry, borrowerAddress, initialCount + 2);

    // --- Step 5. Confirm NFTs Minted on Creditcoin ---
    console.log(`\n--- 5. Confirming NFTs on Creditcoin ---`);
    const borrowEventId = eventsAfterBorrow[eventsAfterBorrow.length - 1];
    const repayEventId = eventsAfterRepay[eventsAfterRepay.length - 1];

    const ownerBorrow = await registry.ownerOf(borrowEventId);
    const ownerRepay = await registry.ownerOf(repayEventId);

    console.log(`NFT for Borrow Event ID ${borrowEventId} owned by: ${ownerBorrow}`);
    console.log(`NFT for Repay Event ID ${repayEventId} owned by: ${ownerRepay}`);

    if (ownerBorrow !== borrowerAddress || ownerRepay !== borrowerAddress) {
        console.error("❌ NFT ownership mismatch. Expected recipient did not receive NFT.");
    } else {
        console.log("✅ Both NFTs successfully minted to borrower.");
    }

    // --- Step 6. Fetching Final Credit Summary ---
    console.log(`\n--- 6. Fetching Final Credit Summary ---`);
    const summary = await registry.getCreditSummary(borrowerAddress);
    const outstandingDebt = await registry.getOutstandingDebt(borrowerAddress);

    // --- Step 7. Final Structured State ---
    const finalState = {
        totalBorrowed: ethers.formatUnits(summary.totalBorrowed, 18),
        totalRepaid: ethers.formatUnits(summary.totalRepaid, 18),
        outstandingDebt: ethers.formatUnits(outstandingDebt, 18),
        onTimeRepayments: summary.onTimeRepayments.toString(),
        defaults: summary.defaults.toString(),
        eventCount: summary.totalEvents.toString()
    };

    console.log(`\n--- 7. Final Structured State ---`);
    console.log(JSON.stringify(finalState, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
