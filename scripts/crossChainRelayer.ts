import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Contract Artifact ABIs
const MockLendingProtocolArtifact = require("../artifacts/contracts/MockLendingProtocol.sol/MockLendingProtocol.json");
const DIKEUSCBridgeArtifact = require("../artifacts/contracts/DIKEUSCBridge.sol/DIKEUSCBridge.json");

// Environment Variables
const SEPOLIA_RPC = process.env.SEPOLIA_RPC;
const CREDITCOIN_RPC = process.env.CREDITCOIN_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!SEPOLIA_RPC || !CREDITCOIN_RPC || !PRIVATE_KEY) {
    throw new Error("Missing required environment variables: SEPOLIA_RPC, CREDITCOIN_RPC, or PRIVATE_KEY");
}

// Target Contract Addresses
const MOCK_LENDING_PROTOCOL_ADDRESS = "0x2AA5f2b1Ad3C63dAdc7BA7De3eed6C79db6C4746";
const DIKE_USC_BRIDGE_ADDRESS = "0x0000000000000000000000000000000000000000"; // Placeholder

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

    // 4. Listen for Repayment Events on Sepolia
    console.log(`\n⏳ Polling for LoanRepaid events on Sepolia...`);

    let lastPolledBlock = await sepoliaProvider.getBlockNumber();

    setInterval(async () => {
        try {
            const currentBlock = await sepoliaProvider.getBlockNumber();
            if (currentBlock <= lastPolledBlock) return;

            const filter = mockLendingProtocol.filters.LoanRepaid();
            const events = await mockLendingProtocol.queryFilter(filter, lastPolledBlock + 1, currentBlock);

            // Fetch network chainId dynamically
            const sepoliaNetwork = await sepoliaProvider.getNetwork();
            const sourceChainId = sepoliaNetwork.chainId.toString();

            for (const event of events) {
                if (event instanceof ethers.EventLog) {
                    // Fetch accurate block timestamp for deterministic proof
                    const block = await sepoliaProvider.getBlock(event.blockNumber);
                    if (!block) continue;

                    const repaymentProof = {
                        borrower: event.args[0],
                        amount: event.args[2].toString(),
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
