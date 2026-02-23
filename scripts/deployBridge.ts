import { ethers, network } from "hardhat";

const REGISTRY_ADDRESS = "0xa194558f68f69eAaA8bbb55700D408349663E57C";

async function main() {
    console.log(`\n--- Deploying DIKEUSCBridge to ${network.name} ---`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer Domain: ${deployer.address}`);

    const factory = await ethers.getContractFactory("DIKEUSCBridge");
    console.log(`Deploying Bridge linked to Registry: ${REGISTRY_ADDRESS}...`);

    const bridge = await factory.deploy(REGISTRY_ADDRESS);
    await bridge.waitForDeployment();

    const bridgeAddress = await bridge.getAddress();

    console.log(`\n======================================`);
    console.log(`DIKEUSCBridge deployed to: ${bridgeAddress}`);
    console.log(`Linked DIKERegistry:       ${REGISTRY_ADDRESS}`);
    console.log(`======================================\n`);

    console.log(`--- Transferring Registry Ownership ---`);

    const registry = await ethers.getContractAt("DIKERegistry", REGISTRY_ADDRESS, deployer);

    console.log(`Initiating transfer of DIKERegistry ownership to DIKEUSCBridge...`);
    const tx = await registry.transferOwnership(bridgeAddress);
    await tx.wait();

    const newOwner = await registry.owner();

    if (newOwner !== bridgeAddress) {
        throw new Error(`Ownership transfer failed! Current Owner: ${newOwner}`);
    }
    console.log(`✅ Ownership transfer confirmed! Registry is now owned by: ${newOwner}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
