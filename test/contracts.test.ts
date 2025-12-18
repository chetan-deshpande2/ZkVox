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
    let registryContract: any;
    let badgeContract: any;
    let poseidonContract: any;
    let deployer: any;

    // Helper for generating Poseidon hashes in JS.
    const poseidonHash = (data: any[]) => {
        if (data.length === 1) return poseidon1(data);
        if (data.length === 2) return poseidon2(data);
        throw new Error("Invalid input length for Poseidon");
    };

    before(async function () {
        [deployer] = await ethers.getSigners();

        // 1. Deploy the generated Verifier contract.
        const VerifierFactory = await ethers.getContractFactory("Verifier");
        verifierContract = await VerifierFactory.deploy();

        // 2. Deploy Real Poseidon from Bytecode
        const poseidonArtifact = require("../build/PoseidonBytecode.json");
        const tx = await deployer.sendTransaction({
            data: poseidonArtifact.bytecode
        });
        const receipt = await tx.wait();
        const poseidonAddress = receipt.contractAddress;

        // We cast it to Poseidon for type safety if needed, 
        // using the Poseidon contract from contracts/Poseidon.sol
        poseidonContract = await ethers.getContractAt("Poseidon", poseidonAddress);

        // 3. Deploy Badge
        const Badge = await ethers.getContractFactory("ZKVoxBadge");
        badgeContract = await Badge.deploy();

        // 4. Deploy Registry
        const MembershipRegistry = await ethers.getContractFactory("MembershipRegistry");
        registryContract = await MembershipRegistry.deploy(await poseidonContract.getAddress(), 0);

        // 5. Deploy the main DAO logic.
        const DAOFactory = await ethers.getContractFactory("ZKDAO");
        daoContract = await DAOFactory.deploy(
            await verifierContract.getAddress(),
            await registryContract.getAddress(),
            await badgeContract.getAddress()
        );

        // Link Badge to DAO
        await badgeContract.setDAOAddress(await daoContract.getAddress());

        // Create a proposal to vote on
        await daoContract.createProposal(1, "Test Prop", "Desc", "IPFS");
    });

    /**
     * Functional Test: Correct Vote Lifecycle.
     * Generates a proof, updates the root, and casts a vote.
     */
    it("Should successfully process a valid vote and track gas usage", async function () {
        const secret = 12345n;
        const proposalID = 1n;
        const voteChoice = 1n;

        // 1. Calculate the Zeros as the contract does
        const depth = 20;
        const zeros = [];
        let currentZero = 0n;
        for (let i = 0; i < depth; i++) {
            zeros.push(currentZero);
            currentZero = poseidonHash([currentZero, currentZero]);
        }

        // 2. Locally compute the Merkle tree membership (index 0)
        const pathElements = [];
        const pathIndices = [];
        let commitment = poseidonHash([secret]);
        let runningHash = commitment;

        for (let i = 0; i < depth; i++) {
            const sibling = zeros[i];
            pathElements.push(sibling);
            pathIndices.push(0);
            runningHash = poseidonHash([runningHash, sibling]);
        }

        const membershipRoot = runningHash.toString();
        const nullifierHash = poseidonHash([secret, proposalID]).toString();

        // 3. Prepare circuit inputs.
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

        // 4. Generate the SNARK proof.
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs, wasm, zkey);

        // Register the member
        await registryContract.register(commitment.toString());

        const rootFromRegistry = await registryContract.root();
        expect(rootFromRegistry.toString()).to.equal(membershipRoot);

        // 5. Format the proof and Vote
        const rawCallData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const parsed = rawCallData.replace(/["[\]\s]/g, "").split(",");

        const a = [parsed[0], parsed[1]];
        const b = [[parsed[2], parsed[3]], [parsed[4], parsed[5]]];
        const c = [parsed[6], parsed[7]];
        const signals = [parsed[8], parsed[9], parsed[10], parsed[11]];

        const voteTx = await daoContract.castVote(
            a, b, c,
            signals[1], // nullifier
            signals[2], // proposalId
            signals[0], // root
            signals[3], // actual vote choice
            deployer.address
        );

        const receipt = await voteTx.wait();
        expect(receipt.status).to.equal(1);

        const tally = await daoContract.getTally(proposalID);
        expect(tally.yes).to.equal(1n);
    });

    it("Should reject votes for non-existent proposals", async function () {
        const secret = 12345n;
        const currentRoot = await registryContract.root();
        const invalidProposalID = 99n;

        await expect(
            daoContract.castVote([0, 0], [[0, 0], [0, 0]], [0, 0], 1, invalidProposalID, currentRoot, 1, deployer.address)
        ).to.be.revertedWith("DAO: Proposal does not exist");
    });

    it("Should allow voting with a root from the registry history (not just current root)", async function () {
        const secret = 12345n;
        const proposalID = 1n;

        // 1. Get current root
        const oldRoot = await registryContract.root();

        // 2. Update registry with a new member to change the root
        await registryContract.register(67890n);
        const newRoot = await registryContract.root();
        expect(newRoot).to.not.equal(oldRoot);

        // 3. Both should be known
        expect(await registryContract.isKnownRoot(oldRoot)).to.be.true;
        expect(await registryContract.isKnownRoot(newRoot)).to.be.true;

        // 4. Try voting with the OLD root (The contract should accept it)
        // We use dummy proof data as we just want to get past the root check
        // Note: It will fail at proof verification, but should NOT fail at "Root mismatch"
        await expect(
            daoContract.castVote([0, 0], [[0, 0], [0, 0]], [0, 0], 1, proposalID, oldRoot, 1, deployer.address)
        ).to.not.be.revertedWith("Registry: Root mismatch or expired");
    });

    it("Should prevent double voting attempts", async function () {
        const secret = 12345n;
        const proposalID = 1n;
        const nullifier = poseidonHash([secret, proposalID]).toString();
        const currentRoot = await registryContract.root();

        await expect(
            daoContract.castVote([0, 0], [[0, 0], [0, 0]], [0, 0], nullifier, proposalID, currentRoot, 1, deployer.address)
        ).to.be.revertedWith("Security: Double voting detected");
    });

    it("Should reject votes if the scalar field overflows", async function () {
        const FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        const maliciousInput = FIELD_PRIME + 1n;

        await expect(
            daoContract.castVote([0, 0], [[0, 0], [0, 0]], [0, 0], maliciousInput.toString(), 1, 1, 1, deployer.address)
        ).to.be.revertedWith("Input overflow: nullifierHash");
    });

    it("Should strictly enforce soulbound properties (non-transferable)", async function () {
        const [, , user2] = await ethers.getSigners();
        // The DAO is required to mint. In governance.test we link user2 to be the "DAO" for a moment
        await badgeContract.setDAOAddress(deployer.address);
        await badgeContract.mint(deployer.address);

        await expect(
            badgeContract.transferFrom(deployer.address, user2.address, 0)
        ).to.be.revertedWithCustomError(badgeContract, "NotTransferable");
    });
});
