import { ethers, network } from "hardhat";

async function main() {
    console.log(`\n--- Deploying DIKERegistry to ${network.name} ---`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer Domain: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer Balance: ${ethers.formatEther(balance)} ether`);

    if (balance === 0n) {
        throw new Error("Deployer has zero balance.");
    }

    const factory = await ethers.getContractFactory("DIKERegistry");
    console.log(`Deploying with initialOwner = ${deployer.address}...`);

    const registry = await factory.deploy(deployer.address);
    const deploymentTx = registry.deploymentTransaction();

    await registry.waitForDeployment();
    const address = await registry.getAddress();

    console.log(`\n======================================`);
    console.log(`DIKERegistry deployed to: ${address}`);

    if (deploymentTx) {
        const receipt = await deploymentTx.wait();
        if (receipt) {
            console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        }
    }

    console.log(`======================================\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
