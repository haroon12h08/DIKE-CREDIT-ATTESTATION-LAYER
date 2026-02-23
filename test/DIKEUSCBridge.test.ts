import { expect } from "chai";
import { ethers } from "hardhat";
import { DIKEUSCBridge, DIKERegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DIKEUSCBridge", function () {
    let bridge: DIKEUSCBridge;
    let registry: DIKERegistry;
    let owner: SignerWithAddress;
    let nonOwner: SignerWithAddress;
    let borrower: SignerWithAddress;

    const sourceChainId = 11155111n; // Sepolia
    const sourceTxHash = ethers.id("txHash1");
    const sourceProtocol = ethers.Wallet.createRandom().address;

    beforeEach(async function () {
        [owner, nonOwner, borrower] = await ethers.getSigners();

        // Deploy Registry
        const DIKERegistryFactory = await ethers.getContractFactory("DIKERegistry");
        registry = await DIKERegistryFactory.deploy(owner.address);
        await registry.waitForDeployment();

        // Deploy Bridge
        const DIKEUSCBridgeFactory = await ethers.getContractFactory("DIKEUSCBridge");
        bridge = await DIKEUSCBridgeFactory.deploy(await registry.getAddress());
        await bridge.waitForDeployment();

        // Transfer Registry ownership to Bridge so Bridge can call recordEvent
        await registry.transferOwnership(await bridge.getAddress());
    });

    describe("Constructor", function () {
        it("Reverts if registry address is zero", async function () {
            const DIKEUSCBridgeFactory = await ethers.getContractFactory("DIKEUSCBridge");
            await expect(
                DIKEUSCBridgeFactory.deploy(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(DIKEUSCBridgeFactory, "ZeroRegistryAddress");
        });
    });

    describe("verifyAndRecordBorrow", function () {
        const amount = ethers.parseUnits("100", 18);

        it("Reverts if borrower is zero address", async function () {
            await expect(
                bridge.verifyAndRecordBorrow(ethers.ZeroAddress, amount, sourceChainId, sourceTxHash, sourceProtocol)
            ).to.be.revertedWithCustomError(bridge, "ZeroBorrowerAddress");
        });

        it("Reverts if amount is zero", async function () {
            await expect(
                bridge.verifyAndRecordBorrow(borrower.address, 0n, sourceChainId, sourceTxHash, sourceProtocol)
            ).to.be.revertedWithCustomError(bridge, "ZeroAmount");
        });

        it("Calls registry, emits BorrowVerified, and records event", async function () {
            await expect(
                bridge.verifyAndRecordBorrow(borrower.address, amount, sourceChainId, sourceTxHash, sourceProtocol)
            )
                .to.emit(bridge, "BorrowVerified")
                .withArgs(borrower.address, amount, sourceChainId, sourceTxHash);

            const summary = await registry.getCreditSummary(borrower.address);
            expect(summary.totalBorrowed).to.equal(amount);
            expect(summary.totalEvents).to.equal(1n);

            const isProcessed = await bridge.processedProofs(sourceTxHash);
            expect(isProcessed).to.be.true;
        });

        it("Prevents duplicate sourceTxHash", async function () {
            await bridge.verifyAndRecordBorrow(borrower.address, amount, sourceChainId, sourceTxHash, sourceProtocol);

            await expect(
                bridge.verifyAndRecordBorrow(borrower.address, amount, sourceChainId, sourceTxHash, sourceProtocol)
            ).to.be.revertedWithCustomError(bridge, "ProofAlreadyProcessed");
        });
    });

    describe("verifyAndRecordRepayment", function () {
        const amount = ethers.parseUnits("50", 18);
        const repayTxHash = ethers.id("repayTxHash1");

        const proof = {
            borrower: "0x0000000000000000000000000000000000000000", // to be overridden
            amount: 0n,
            sourceChainId,
            sourceTxHash: repayTxHash,
            sourceProtocol,
            timestamp: 1234567890n
        };

        it("Reverts if borrower is zero address", async function () {
            const badProof = { ...proof, amount };
            await expect(
                bridge.verifyAndRecordRepayment(badProof)
            ).to.be.revertedWithCustomError(bridge, "ZeroBorrowerAddress");
        });

        it("Reverts if amount is zero", async function () {
            const badProof = { ...proof, borrower: borrower.address };
            await expect(
                bridge.verifyAndRecordRepayment(badProof)
            ).to.be.revertedWithCustomError(bridge, "ZeroAmount");
        });

        it("Calls registry with normalized amount and emits RepaymentVerified", async function () {
            const goodProof = { ...proof, borrower: borrower.address, amount };

            await expect(bridge.verifyAndRecordRepayment(goodProof))
                .to.emit(bridge, "RepaymentVerified")
                .withArgs(borrower.address, amount, sourceChainId, repayTxHash);

            const summary = await registry.getCreditSummary(borrower.address);
            expect(summary.totalRepaid).to.equal(amount);
            expect(summary.onTimeRepayments).to.equal(1n);
            expect(summary.totalEvents).to.equal(1n);
        });

        it("Prevents replay of the same repayment proof", async function () {
            const goodProof = { ...proof, borrower: borrower.address, amount };
            await bridge.verifyAndRecordRepayment(goodProof);

            await expect(
                bridge.verifyAndRecordRepayment(goodProof)
            ).to.be.revertedWithCustomError(bridge, "ProofAlreadyProcessed");
        });
    });

    describe("Pausable", function () {
        const amount = ethers.parseUnits("100", 18);

        it("Reverts verify functions when paused", async function () {
            await bridge.pause();

            await expect(
                bridge.verifyAndRecordBorrow(borrower.address, amount, sourceChainId, sourceTxHash, sourceProtocol)
            ).to.be.revertedWithCustomError(bridge, "EnforcedPause");

            const proof = {
                borrower: borrower.address,
                amount,
                sourceChainId,
                sourceTxHash: ethers.id("repayTx"),
                sourceProtocol,
                timestamp: 1234567890n
            };

            await expect(
                bridge.verifyAndRecordRepayment(proof)
            ).to.be.revertedWithCustomError(bridge, "EnforcedPause");
        });

        it("Resumes working after unpause", async function () {
            await bridge.pause();
            await bridge.unpause();

            await expect(
                bridge.verifyAndRecordBorrow(borrower.address, amount, sourceChainId, sourceTxHash, sourceProtocol)
            ).to.not.be.reverted;
        });
    });

    describe("Ownership", function () {
        const amount = ethers.parseUnits("100", 18);

        it("Only owner can verify borrow", async function () {
            await expect(
                bridge.connect(nonOwner).verifyAndRecordBorrow(borrower.address, amount, sourceChainId, sourceTxHash, sourceProtocol)
            ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
                .withArgs(nonOwner.address);
        });

        it("Only owner can verify repayment", async function () {
            const proof = {
                borrower: borrower.address,
                amount,
                sourceChainId,
                sourceTxHash: ethers.id("repayTx"),
                sourceProtocol,
                timestamp: 1234567890n
            };
            await expect(
                bridge.connect(nonOwner).verifyAndRecordRepayment(proof)
            ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
                .withArgs(nonOwner.address);
        });

        it("Only owner can pause/unpause", async function () {
            await expect(
                bridge.connect(nonOwner).pause()
            ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
                .withArgs(nonOwner.address);

            await expect(
                bridge.connect(nonOwner).unpause()
            ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
                .withArgs(nonOwner.address);
        });
    });
});
