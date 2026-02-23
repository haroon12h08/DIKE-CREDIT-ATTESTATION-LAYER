import { expect } from "chai";
import { ethers } from "hardhat";
import { DIKERegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DIKERegistry", function () {
    let registry: DIKERegistry;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    const EventType = {
        BORROW: 0n,
        REPAY_ON_TIME: 1n,
        REPAY_LATE: 2n,
        DEFAULT: 3n,
    };

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        const DIKERegistryFactory = await ethers.getContractFactory("DIKERegistry");
        registry = await DIKERegistryFactory.deploy(owner.address);
        await registry.waitForDeployment();
    });

    describe("recordEvent", function () {
        const amount = ethers.parseUnits("100", 18);
        const refHash = ethers.id("reference1");

        it("Reverts if subject is zero", async function () {
            await expect(
                registry.recordEvent(ethers.ZeroAddress, amount, EventType.BORROW, refHash)
            ).to.be.revertedWith("Invalid subject: zero address");
        });

        it("Reverts if amount is zero", async function () {
            await expect(
                registry.recordEvent(user1.address, 0, EventType.BORROW, refHash)
            ).to.be.revertedWith("Amount must be strictly positive");
        });

        it("Reverts if duplicate referenceHash", async function () {
            await registry.recordEvent(user1.address, amount, EventType.BORROW, refHash);
            await expect(
                registry.recordEvent(user1.address, amount, EventType.REPAY_ON_TIME, refHash)
            ).to.be.revertedWith("Duplicate reference");
        });

        it("Mints NFT correctly", async function () {
            await registry.recordEvent(user1.address, amount, EventType.BORROW, refHash);
            expect(await registry.ownerOf(0)).to.equal(user1.address);
            expect(await registry.balanceOf(user1.address)).to.equal(1n);
        });

        it("Updates userTotals correctly", async function () {
            await registry.recordEvent(user1.address, amount, EventType.BORROW, refHash);
            let totals = await registry.userTotals(user1.address);
            expect(totals.totalBorrowed).to.equal(amount);
            expect(totals.totalEvents).to.equal(1n);

            const repayAmount = ethers.parseUnits("50", 18);
            const refHash2 = ethers.id("reference2");
            await registry.recordEvent(user1.address, repayAmount, EventType.REPAY_ON_TIME, refHash2);

            totals = await registry.userTotals(user1.address);
            expect(totals.totalRepaid).to.equal(repayAmount);
            expect(totals.onTimeRepayments).to.equal(1n);
            expect(totals.totalEvents).to.equal(2n);
        });

        it("Updates systemTotals correctly", async function () {
            const amount1 = ethers.parseUnits("100", 18);
            const amount2 = ethers.parseUnits("200", 18);

            await registry.recordEvent(user1.address, amount1, EventType.BORROW, ethers.id("ref1"));
            await registry.recordEvent(user2.address, amount2, EventType.BORROW, ethers.id("ref2"));

            expect(await registry.totalSystemBorrowed()).to.equal(amount1 + amount2);
        });
    });

    describe("getCreditSummary", function () {
        it("Returns correct aggregated values and ratios", async function () {
            const borrowAmount = ethers.parseUnits("1000", 18);
            const repayAmount1 = ethers.parseUnits("500", 18);
            const repayAmount2 = ethers.parseUnits("500", 18);

            await registry.recordEvent(user1.address, borrowAmount, EventType.BORROW, ethers.id("borrow1"));
            await registry.recordEvent(user1.address, repayAmount1, EventType.REPAY_ON_TIME, ethers.id("repay1"));
            await registry.recordEvent(user1.address, repayAmount2, EventType.REPAY_LATE, ethers.id("repay2"));
            await registry.recordEvent(user1.address, 0n /* ignored but fails if 0 so pass 1 */ + 1n, EventType.DEFAULT, ethers.id("default1")); // amount > 0 is required

            const summary = await registry.getCreditSummary(user1.address);

            expect(summary.totalBorrowed).to.equal(borrowAmount);
            expect(summary.totalRepaid).to.equal(repayAmount1 + repayAmount2);
            expect(summary.defaults).to.equal(1n);
            expect(summary.onTimeRepayments).to.equal(1n);
            expect(summary.lateRepayments).to.equal(1n);
            expect(summary.totalEvents).to.equal(4n);

            // onTimeRatio = onTime / (onTime + late) * 1e18 = 1 / 2 * 1e18
            const expectedRatio = ethers.parseUnits("0.5", 18);
            expect(summary.onTimeRatio).to.equal(expectedRatio);

            // defaultRate = defaults / totalEvents * 1e18 = 1 / 4 * 1e18
            const expectedDefaultRate = ethers.parseUnits("0.25", 18);
            expect(summary.defaultRate).to.equal(expectedDefaultRate);
        });
    });

    describe("getOutstandingDebt", function () {
        it("Returns correct difference", async function () {
            const borrowAmount = ethers.parseUnits("1000", 18);
            const repayAmount = ethers.parseUnits("400", 18);

            await registry.recordEvent(user1.address, borrowAmount, EventType.BORROW, ethers.id("borrow1"));
            await registry.recordEvent(user1.address, repayAmount, EventType.REPAY_ON_TIME, ethers.id("repay1"));

            const debt = await registry.getOutstandingDebt(user1.address);
            expect(debt).to.equal(borrowAmount - repayAmount);
        });

        it("Returns 0 if repaid > borrowed", async function () {
            const borrowAmount = ethers.parseUnits("500", 18);
            const repayAmount = ethers.parseUnits("600", 18);

            await registry.recordEvent(user1.address, borrowAmount, EventType.BORROW, ethers.id("borrow1"));
            await registry.recordEvent(user1.address, repayAmount, EventType.REPAY_ON_TIME, ethers.id("repay1"));

            const debt = await registry.getOutstandingDebt(user1.address);
            expect(debt).to.equal(0n);
        });
    });

    describe("tokenURI", function () {
        it("Reverts for nonexistent token", async function () {
            await expect(registry.tokenURI(999)).to.be.revertedWith("Nonexistent token");
        });

        it("Returns valid base64 JSON containing readable eventType string", async function () {
            const amount = ethers.parseUnits("100", 18);
            const refHash = ethers.id("borrow1");
            await registry.recordEvent(user1.address, amount, EventType.BORROW, refHash);

            const uri = await registry.tokenURI(0);
            expect(uri).to.contain("data:application/json;base64,");

            const base64Data = uri.split(",")[1];
            const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
            const jsonTemplate = JSON.parse(jsonString);

            expect(jsonTemplate.name).to.equal("DIKE Credit Event #0");

            const eventTypeAttr = jsonTemplate.attributes.find((a: any) => a.trait_type === "Event Type");
            expect(eventTypeAttr.value).to.equal("BORROW");

            const amountAttr = jsonTemplate.attributes.find((a: any) => a.trait_type === "Amount");
            expect(amountAttr.value).to.equal(amount.toString());
        });
    });

    describe("usedReferences", function () {
        it("Prevents duplicate event minting", async function () {
            const amount = ethers.parseUnits("100", 18);
            const refHash = ethers.id("uniqueRef");

            await registry.recordEvent(user1.address, amount, EventType.BORROW, refHash);

            expect(await registry.usedReferences(refHash)).to.be.true;

            await expect(
                registry.recordEvent(user1.address, amount, EventType.REPAY_ON_TIME, refHash)
            ).to.be.revertedWith("Duplicate reference");
        });
    });
});
