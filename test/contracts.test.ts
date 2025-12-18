import { expect } from "chai";
import { ethers } from "hardhat";
import * as snarkjs from "snarkjs";
import path from "path";
const { poseidon1, poseidon2 } = require("poseidon-lite");

/**
 * On-chain Integration Tests.
 * This suite verifies the interaction between the ZK proofs 
 * generated locally and the ZKDAO smart contract.
 */
describe("ZKDAO System Integration", function () {
    let verifierContract: any;
    let daoContract: any;
    let deployer: any;

    // Helper for generating Poseidon hashes in JS.
    const poseidonHash = (data: any[]) => {
        if (data.length === 1) return poseidon1(data);
        if (data.length === 2) return poseidon2(data);
        throw new Error("Invalid input length for Poseidon");
    };

    before(async function () {
        [deployer] = await ethers.getSigners();

        // Deploy the generated Verifier contract.
        const VerifierFactory = await ethers.getContractFactory("Verifier");
        verifierContract = await VerifierFactory.deploy();
        await verifierContract.waitForDeployment();

        // Deploy the main DAO logic.
        const DAOFactory = await ethers.getContractFactory("ZKDAO");
        daoContract = await DAOFactory.deploy(await verifierContract.getAddress(), 0);
        await daoContract.waitForDeployment();
    });

    /**
     * Functional Test: Correct Vote Lifecycle.
     * Generates a proof, updates the root, and casts a vote.
     */
    it("Should successfully process a valid vote and track gas usage", async function () {
        const secret = 12345n;
        const proposalID = 1n;
        const voteChoice = 1n;

        // 1. Locally compute the Merkle tree membership.
        const depth = 20;
        const pathElements = [];
        const pathIndices = [];
        let runningHash = poseidonHash([secret]);

        for (let i = 0; i < depth; i++) {
            const sibling = BigInt(i + 100);
            pathElements.push(sibling);
            pathIndices.push(0);
            runningHash = poseidonHash([runningHash, sibling]);
        }

        const membershipRoot = runningHash.toString();
        const nullifierHash = poseidonHash([secret, proposalID]).toString();

        // 2. Prepare circuit inputs.
        const circuitInputs = {
            root: membershipRoot,
            nullifierHash: nullifierHash,
            proposalId: Number(proposalID),
            secret: secret,
            pathElements: pathElements.map(e => e.toString()),
            pathIndices: pathIndices,
            vote: Number(voteChoice)
        };

        const wasm = path.join(__dirname, "../build/vote_js/vote.wasm");
        const zkey = path.join(__dirname, "../build/vote_final.zkey");

        // 3. Generate the SNARK proof.
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs, wasm, zkey);

        // Update the contract state to simulate the voter being in the set.
        await daoContract.updateRoot(publicSignals[0]);

        // 4. Format the proof for the Solidity call.
        const rawCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const parsed = rawCallData.replace(/["[\]\s]/g, "").split(",");

        const a = [parsed[0], parsed[1]];
        const b = [[parsed[2], parsed[3]], [parsed[4], parsed[5]]];
        const c = [parsed[6], parsed[7]];
        const signals = [parsed[8], parsed[9], parsed[10], parsed[11]];

        // 5. Execute the on-chain transaction.
        const voteTx = await daoContract.castVote(
            a, b, c,
            signals[1], // nullifier
            signals[2], // proposalId
            signals[0], // root
            signals[3]  // actual vote choice
        );

        const receipt = await voteTx.wait();
        console.log(`\n⛽ INTEGRATION GAS: ${receipt.gasUsed.toString()} gas`);

        expect(receipt.status).to.equal(1);

        // Verify that the vote was correctly recorded.
        expect(await daoContract.yesVotes(proposalID)).to.equal(1n);
    });

    it("Should prevent double voting attempts", async function () {
        // We attempt to re-use the same nullifier emitted in the previous successful vote.
        // Factoring out data generation for brevity.
        const secret = 12345n;
        const proposalID = 1n;

        // Re-generate the nullifier.
        const nullifier = poseidonHash([secret, proposalID]).toString();

        // Get the current root from the contract so we don't hit "Root mismatch"
        const currentRoot = await daoContract.merkleRoot();

        // Try casting any vote with this used nullifier (proof format doesn't matter for this check)
        // Note: Contract checks nullifier BEFORE proof for efficiency.
        await expect(
            daoContract.castVote([0, 0], [[0, 0], [0, 0]], [0, 0], nullifier, proposalID, currentRoot, 1)
        ).to.be.revertedWith("Security: Double voting detected");
    });

    it("Should reject votes if the scalar field overflows", async function () {
        const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        const maliciousInput = FIELD_PRIME + 1n;

        await expect(
            daoContract.castVote([0, 0], [[0, 0], [0, 0]], [0, 0], maliciousInput.toString(), 1, 1, 1)
        ).to.be.revertedWith("Input overflow: nullifierHash");
    });
});
