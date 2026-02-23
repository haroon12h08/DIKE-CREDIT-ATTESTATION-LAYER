import { ethers } from "hardhat";
async function main() {
    const REGISTRY_ADDRESS = ethers.getAddress("0xa194558f68f69eAaA8bbb55700D408349663E57C");
    const NEW_BRIDGE_ADDRESS = ethers.getAddress("0x75375cF67A3D208dc5587f0B069038eaFb9803a8");
    const [deployer] = await ethers.getSigners();
    const registry = await ethers.getContractAt("DIKERegistry", REGISTRY_ADDRESS, deployer);
    console.log(`Transferring Ownership of ${REGISTRY_ADDRESS} to ${NEW_BRIDGE_ADDRESS}...`);
    const tx = await registry.transferOwnership(NEW_BRIDGE_ADDRESS, { gasLimit: 500000 });
    await tx.wait();
    console.log("Registry Owner is now:", await registry.owner());
}
main().catch(console.error);
