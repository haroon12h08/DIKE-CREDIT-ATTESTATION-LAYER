import { expect } from "chai";
import { ethers } from "hardhat";
import { MockToken, MockLendingProtocol, DIKERegistry, DIKEUSCBridge } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DIKE Integration Flow", function () {
    let mockToken: MockToken;
    let mockProtocol: MockLendingProtocol;
    let registry: DIKERegistry;
    let bridge: DIKEUSCBridge;

    let deployer: SignerWithAddress;
    let borrower: SignerWithAddress;

    const sourceChainId = 11155111n;

    before(async function () {
        [deployer, borrower] = await ethers.getSigners();

        // 1. Deploy MockToken
        const MockTokenFactory = await ethers.getContractFactory("MockToken");
        const initialSupply = ethers.parseUnits("1000000", 18);
        mockToken = await MockTokenFactory.deploy(initialSupply);
        await mockToken.waitForDeployment();

        // 2. Deploy MockLendingProtocol
        const MockLendingProtocolFactory = await ethers.getContractFactory("MockLendingProtocol");
        mockProtocol = await MockLendingProtocolFactory.deploy(await mockToken.getAddress());
        await mockProtocol.waitForDeployment();

        // Fund protocol and user
        const fundAmount = ethers.parseUnits("500000", 18);
        await mockToken.approve(await mockProtocol.getAddress(), fundAmount);
        await mockProtocol.fund(fundAmount);

        // Give borrower some tokens for repayment later if needed
        await mockToken.transfer(borrower.address, ethers.parseUnits("1000", 18));

        // 3. Deploy DIKERegistry
        const DIKERegistryFactory = await ethers.getContractFactory("DIKERegistry");
        registry = await DIKERegistryFactory.deploy(deployer.address);
        await registry.waitForDeployment();

        // 4. Deploy DIKEUSCBridge
        const DIKEUSCBridgeFactory = await ethers.getContractFactory("DIKEUSCBridge");
        bridge = await DIKEUSCBridgeFactory.deploy(await registry.getAddress());
        await bridge.waitForDeployment();

        // 5. Transfer ownership to bridge
        await registry.transferOwnership(await bridge.getAddress());
    });

    it("Simulates full cross-chain borrow and repay cycle", async function () {
        const borrowAmount = ethers.parseUnits("100", 18);

        // 6. Simulate borrow
        const borrowTx = await mockProtocol.connect(borrower).borrow(borrowAmount);
        const borrowReceipt = await borrowTx.wait();
        const borrowTxHash = borrowReceipt?.hash;
        expect(borrowTxHash).to.exist;

        // 8. Manually call bridge verification for Borrow
        await bridge.verifyAndRecordBorrow(
            borrower.address,
            borrowAmount,
            sourceChainId,
            borrowTxHash!,
            await mockProtocol.getAddress()
        );

        // 7. Simulate repay
        await mockToken.connect(borrower).approve(await mockProtocol.getAddress(), borrowAmount);
        const repayTx = await mockProtocol.connect(borrower).repay(0); // loanId 0
        const repayReceipt = await repayTx.wait();
        const repayTxHash = repayReceipt?.hash;
        expect(repayTxHash).to.exist;

        // 8. Manually call bridge verification for Repay
        const repayProof = {
            borrower: borrower.address,
            amount: borrowAmount,
            sourceChainId: sourceChainId,
            sourceTxHash: repayTxHash!,
            sourceProtocol: await mockProtocol.getAddress(),
            timestamp: 0n // Not strictly checked for deduplication in current bridge logic
        };

        await bridge.verifyAndRecordRepayment(repayProof);

        // 9. Assertions
        const summary = await registry.getCreditSummary(borrower.address);
        const debt = await registry.getOutstandingDebt(borrower.address);

        // Assert: 2 NFTs minted
        expect(await registry.balanceOf(borrower.address)).to.equal(2n);
        expect(await registry.ownerOf(0n)).to.equal(borrower.address);
        expect(await registry.ownerOf(1n)).to.equal(borrower.address);

        // Assert: totalBorrowed correct
        expect(summary.totalBorrowed).to.equal(borrowAmount);

        // Assert: totalRepaid correct
        expect(summary.totalRepaid).to.equal(borrowAmount);

        // Assert: outstandingDebt correct
        expect(debt).to.equal(0n);

        // Assert: eventCount correct
        expect(summary.totalEvents).to.equal(2n);

        // Ensure defaults remain 0
        expect(summary.defaults).to.equal(0n);

        // --- INVARIANT ASSERTIONS ---
        await assertInvariants(registry, borrower.address);
    });

    async function assertInvariants(registryContract: DIKERegistry, userAddress: string) {
        const summary = await registryContract.getCreditSummary(userAddress);
        const userEvents = await registryContract.getUserEvents(userAddress);
        const nextEventId = await registryContract.nextEventId();

        let lateRepaymentsAmount = 0n;
        for (let i = 0; i < userEvents.length; i++) {
            const eventId = userEvents[i];
            const event = await registryContract.getCreditEvent(eventId);
            if (event.eventType === 2n) { // EventType.REPAY_LATE
                lateRepaymentsAmount += event.amount;
            }
        }

        // Invariant 1: totalRepaid <= totalBorrowed + lateRepaymentsAmount
        expect(summary.totalRepaid).to.be.lessThanOrEqual(summary.totalBorrowed + lateRepaymentsAmount);

        // Invariant 2: eventCount == userEventIds.length
        expect(summary.totalEvents).to.equal(BigInt(userEvents.length));

        // Invariant 3: NFT supply == nextEventId
        const balance = await registryContract.balanceOf(userAddress);
        expect(balance).to.equal(nextEventId);
    }
});
