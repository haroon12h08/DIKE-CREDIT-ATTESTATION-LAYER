import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Contract Artifact ABIs
const MockLendingProtocolArtifact = require("../artifacts/contracts/MockLendingProtocol.sol/MockLendingProtocol.json");
const DIKEUSCBridgeArtifact = require("../artifacts/contracts/DIKEUSCBridge.sol/DIKEUSCBridge.json");
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
const DIKE_USC_BRIDGE_ADDRESS = "0x75375cF67A3D208dc5587f0B069038eaFb9803a8";
const DIKE_REGISTRY_ADDRESS = "0xa194558f68f69eAaA8bbb55700D408349663E57C";

async function validateRegistryState(dikeRegistry: ethers.Contract, borrower: string) {
    console.log(`\n🔍 Validating Registry State...`);
    const summaryRaw = await dikeRegistry.getCreditSummary(borrower);
    const userEvents = await dikeRegistry.getUserEvents(borrower);

    let latestEventId = "N/A";
    let nftOwner = "N/A";

    if (userEvents.length > 0) {
        const latestEvent = userEvents[userEvents.length - 1];
        latestEventId = latestEvent.toString();
        nftOwner = await dikeRegistry.ownerOf(latestEvent);
    }

    const validationObject = {
        summary: {
            totalBorrowed: summaryRaw.totalBorrowed.toString(),
            totalRepaid: summaryRaw.totalRepaid.toString(),
            defaults: summaryRaw.defaults.toString(),
            totalEvents: summaryRaw.totalEvents.toString()
        },
        newEventId: latestEventId,
        nftOwner: nftOwner
    };

    console.log(`\n================================`);
    console.log(`✅ Registry State Validation Finished`);
    console.log(`================================`);
    console.log(JSON.stringify(validationObject, null, 2));
}

async function main() {
    // 1. Initialize Providers
    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const creditcoinProvider = new ethers.JsonRpcProvider(CREDITCOIN_RPC);

    // 2. Initialize Wallets tied to their respective chains
    const sepoliaWallet = new ethers.Wallet(PRIVATE_KEY as string, sepoliaProvider);
    const creditcoinWallet = new ethers.Wallet(PRIVATE_KEY as string, creditcoinProvider);

    // 3. Initialize Contract Instances
    const mockLendingProtocol = new ethers.Contract(
        MOCK_LENDING_PROTOCOL_ADDRESS,
        MockLendingProtocolArtifact.abi,
        sepoliaWallet
    );

    const dikeUSCBridge = new ethers.Contract(
        DIKE_USC_BRIDGE_ADDRESS,
        DIKEUSCBridgeArtifact.abi,
        creditcoinWallet
    );

    const dikeRegistry = new ethers.Contract(
        DIKE_REGISTRY_ADDRESS,
        DIKERegistryArtifact.abi,
        creditcoinWallet
    );

    // Fetch token decimals for normalization
    const tokenAddress = await mockLendingProtocol.token();
    const mockToken = new ethers.Contract(tokenAddress, ["function decimals() view returns (uint8)"], sepoliaProvider);
    const tokenDecimals = BigInt(await mockToken.decimals());

    if (tokenDecimals > 18n) {
        throw new Error("Token decimals > 18 not supported");
    }

    // 4. Listen for Events on Sepolia
    console.log(`\n⏳ Polling for LoanBorrowed & LoanRepaid events on Sepolia...`);

    // Start indexing 100 blocks in the past to catch any missed events while offline
    let lastPolledBlock = (await sepoliaProvider.getBlockNumber()) - 100;
    const processedTxHashes = new Set<string>(); // Memory-only replay protection

    setInterval(async () => {
        try {
            const currentBlock = await sepoliaProvider.getBlockNumber();
            if (currentBlock <= lastPolledBlock) return;

            const repayFilter = mockLendingProtocol.filters.LoanRepaid();
            const borrowFilter = mockLendingProtocol.filters.LoanBorrowed();

            const repayEvents = await mockLendingProtocol.queryFilter(repayFilter, lastPolledBlock + 1, currentBlock);
            const borrowEvents = await mockLendingProtocol.queryFilter(borrowFilter, lastPolledBlock + 1, currentBlock);

            // Fetch network chainId dynamically
            const sepoliaNetwork = await sepoliaProvider.getNetwork();
            const sourceChainId = sepoliaNetwork.chainId.toString();

            // Process Repayments
            for (const event of repayEvents) {
                if (event instanceof ethers.EventLog) {
                    // Fetch accurate block timestamp for deterministic proof
                    const block = await sepoliaProvider.getBlock(event.blockNumber);
                    if (!block) continue;

                    let amountRaw = BigInt(event.args[2].toString());
                    let normalizedAmount = amountRaw;
                    if (tokenDecimals < 18n) {
                        normalizedAmount = amountRaw * (10n ** (18n - tokenDecimals));
                    }

                    const repaymentProof = {
                        borrower: event.args[0],
                        amount: normalizedAmount.toString(),
                        sourceChainId: sourceChainId,
                        sourceTxHash: event.transactionHash,
                        sourceProtocol: MOCK_LENDING_PROTOCOL_ADDRESS,
                        timestamp: block.timestamp
                    };

                    // Validate required proof fields before proceeding
                    if (!repaymentProof.borrower || repaymentProof.borrower === ethers.ZeroAddress) {
                        console.error("❌ Invalid borrower address in proof. Skipping.");
                        continue;
                    }
                    if (repaymentProof.amount === "0") {
                        console.error("❌ Invalid amount in proof. Skipping.");
                        continue;
                    }
                    if (!repaymentProof.sourceTxHash) {
                        console.error("❌ Missing transaction hash in proof. Skipping.");
                        continue;
                    }

                    console.log(`\n================================`);
                    console.log(`💰 New Repayment Proof Generated!`);
                    console.log(`================================`);
                    console.log(JSON.stringify(repaymentProof, null, 2));

                    // Check if proof was already processed by the bridge
                    const isProcessed = await dikeUSCBridge.processedProofs(repaymentProof.sourceTxHash);
                    if (isProcessed || processedTxHashes.has(repaymentProof.sourceTxHash)) {
                        console.log(`⚠️  Proof already processed or in-flight. Skipping relay.`);
                        continue;
                    }
                    processedTxHashes.add(repaymentProof.sourceTxHash);

                    // Relay the proof to DIKEUSCBridge
                    console.log(`\n🚀 Relaying proof to Creditcoin Bridge...`);
                    try {
                        const relayTx = await dikeUSCBridge.verifyAndRecordRepayment(repaymentProof);
                        const relayReceipt = await relayTx.wait();

                        console.log(`✅ Relay Successful`);
                        console.log(`   Bridge TxHash: ${relayReceipt.hash}`);
                        console.log(`   Gas Used:      ${relayReceipt.gasUsed.toString()}`);

                        // Validate against Registry
                        await validateRegistryState(dikeRegistry, repaymentProof.borrower);
                    } catch (relayError) {
                        console.error(`❌ Repay Relay Transaction Failed:`, relayError);
                    }
                }
            }

            // Process Borrows
            for (const event of borrowEvents) {
                if (event instanceof ethers.EventLog) {
                    let amountRaw = BigInt(event.args[2].toString());
                    let normalizedAmount = amountRaw;
                    if (tokenDecimals < 18n) {
                        normalizedAmount = amountRaw * (10n ** (18n - tokenDecimals));
                    }

                    const borrowProof = {
                        borrower: event.args[0],
                        amount: normalizedAmount.toString(),
                        sourceChainId: sourceChainId,
                        sourceTxHash: event.transactionHash,
                        sourceProtocol: MOCK_LENDING_PROTOCOL_ADDRESS
                    };

                    if (!borrowProof.borrower || borrowProof.borrower === ethers.ZeroAddress) continue;
                    if (borrowProof.amount === "0") continue;
                    if (!borrowProof.sourceTxHash) continue;

                    console.log(`\n================================`);
                    console.log(`💸 New Borrow Proof Generated!`);
                    console.log(`================================`);
                    console.log(JSON.stringify(borrowProof, null, 2));

                    const isProcessed = await dikeUSCBridge.processedProofs(borrowProof.sourceTxHash);
                    if (isProcessed || processedTxHashes.has(borrowProof.sourceTxHash)) {
                        console.log(`⚠️  Borrow Proof already processed or in-flight. Skipping relay.`);
                        continue;
                    }
                    processedTxHashes.add(borrowProof.sourceTxHash);

                    console.log(`\n🚀 Relaying borrow proof to Creditcoin Bridge...`);
                    try {
                        const relayTx = await dikeUSCBridge.verifyAndRecordBorrow(
                            borrowProof.borrower,
                            borrowProof.amount,
                            borrowProof.sourceChainId,
                            borrowProof.sourceTxHash,
                            borrowProof.sourceProtocol
                        );
                        const relayReceipt = await relayTx.wait();

                        console.log(`✅ Borrow Relay Successful`);
                        console.log(`   Bridge TxHash: ${relayReceipt.hash}`);
                        console.log(`   Gas Used:      ${relayReceipt.gasUsed.toString()}`);

                        // Validate against Registry
                        await validateRegistryState(dikeRegistry, borrowProof.borrower);
                    } catch (relayError) {
                        console.error(`❌ Borrow Relay Transaction Failed:`, relayError);
                    }
                }
            }

            lastPolledBlock = currentBlock;
        } catch (error) {
            console.error("Polling Error:", error);
        }
    }, 10000); // 10 second polling
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
