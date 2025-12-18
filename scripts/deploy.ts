import { ethers, network } from "hardhat";

/**
 * Main deployment script for the ZKVox (ZK DAO) Advanced Ecosystem.
 * 
 * Usage:
 * bun run hardhat run scripts/deploy.ts --network <network_name>
 */
async function main() {
    console.log(">> Starting Advanced Deployment process...");

    // 1. Deploy the Verifier (Generated from snarkjs)
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log(`✅ Verifier deployed to: ${verifierAddress}`);

    // 2. Deploy Real Poseidon from Bytecode
    const poseidonArtifact = require("../build/PoseidonBytecode.json");
    const [deployer] = await ethers.getSigners();

    const poseidonAddress = await deployer.sendTransaction({
        data: poseidonArtifact.bytecode
    }).then(tx => tx.wait().then(receipt => receipt?.contractAddress));

    console.log(`✅ Poseidon (Production) deployed to: ${poseidonAddress}`);

    // 3. Deploy ZKVox Badge (Soulbound NFT)
    const Badge = await ethers.getContractFactory("ZKVoxBadge");
    const badge = await Badge.deploy();
    await badge.waitForDeployment();
    const badgeAddress = await badge.getAddress();
    console.log(`✅ ZKVoxBadge deployed to: ${badgeAddress}`);

    // 4. Deploy Membership Registry (Depth 20)
    // Empty leaf set to 0.
    const Registry = await ethers.getContractFactory("MembershipRegistry");
    const registry = await Registry.deploy(poseidonAddress, 0);
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`✅ MembershipRegistry deployed to: ${registryAddress}`);

    // 5. Deploy the main ZKDAO Contract
    const ZKDAO = await ethers.getContractFactory("ZKDAO");
    const zkdao = await ZKDAO.deploy(
        verifierAddress,
        registryAddress,
        badgeAddress
    );
    await zkdao.waitForDeployment();
    const zkdaoAddress = await zkdao.getAddress();
    console.log(`✅ ZKDAO deployed to: ${zkdaoAddress}`);

    // 6. Link Badge to DAO
    await badge.setDAOAddress(zkdaoAddress);
    console.log("✅ Badge access control linked to ZKDAO");

    console.log("\n--------------------------------------------------");
    console.log("Deployment Summary:");
    console.log(`- Network: ${network.name}`);
    console.log(`- ZKDAO: ${zkdaoAddress}`);
    console.log(`- Registry: ${registryAddress}`);
    console.log(`- Badge NFT: ${badgeAddress}`);
    console.log("--------------------------------------------------\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
