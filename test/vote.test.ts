const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const circom_tester = require("circom_tester");
const wasm_tester = circom_tester.wasm;
const { poseidon1, poseidon2 } = require("poseidon-lite");

/**
 * Unit tests for the core Vote circuit.
 * These tests ensure the mathematical constraints for Merkle proofs,
 * nullifiers, and vote range work as expected.
 */
describe("Circuit Unit Tests", function () {
    this.timeout(100000); // SNARK proof generation can be slow on local machines.

    let voteCircuit: any;

    before(async function () {
        // NOTE: We use a relative path here to avoid shell-escaping issues in circom paths.
        voteCircuit = await wasm_tester("circuits/vote.circom");
    });

    // Internal helper for Poseidon hashing logic.
    const computeHash = (data: any) => {
        if (data.length === 1) return poseidon1(data);
        if (data.length === 2) return poseidon2(data);
        throw new Error(`Hash error: Poseidon not implemented for ${data.length} inputs`);
    };

    /**
     * Simulation: Generate a local Merkle tree path.
     * In production, this would be computed from a live database or on-chain event logs.
     */
    function buildMockMembershipProof(depth, secret, index) {
        let current = computeHash([BigInt(secret)]); // Identity Commitment

        const elements = [];
        const indices = [];

        let tempIndex = index;
        for (let i = 0; i < depth; i++) {
            const dummySibling = BigInt(i + 42); // Arbitrary starting point for dummy nodes.
            elements.push(dummySibling);

            const bit = tempIndex % 2;
            indices.push(bit);

            // Re-hash to climb up the tree.
            if (bit === 0) {
                current = computeHash([current, dummySibling]);
            } else {
                current = computeHash([dummySibling, current]);
            }

            tempIndex = Math.floor(tempIndex / 2);
        }

        return {
            computedRoot: current,
            elements,
            indices
        };
    }

    it("Should successfully verify a legitimate DAO member", async function () {
        const TREE_DEPTH = 20;
        const voterSecret = 1337n;
        const activeProposal = 1n;
        const choice = 1n; // Yes

        // 1. Setup membership state.
        const { computedRoot, elements, indices } = buildMockMembershipProof(TREE_DEPTH, voterSecret, 0);

        // 2. Derive the nullifier.
        const expectedNullifier = computeHash([voterSecret, activeProposal]);

        // 3. Formulate the circuit inputs.
        const circuitInput = {
            root: computedRoot,
            nullifierHash: expectedNullifier,
            proposalId: activeProposal,
            secret: voterSecret,
            pathElements: elements,
            pathIndices: indices,
            vote: choice
        };

        // 4. Run the witness calculation and check constraints.
        const witness = await voteCircuit.calculateWitness(circuitInput, true);
        await voteCircuit.checkConstraints(witness);
    });

    it("Should reject an incorrect secret (Root mismatch)", async function () {
        const { computedRoot, elements, indices } = buildMockMembershipProof(20, 12345n, 0);

        const wrongSecret = 999n;
        const nullifierForWrongSecret = computeHash([wrongSecret, 1n]);

        const badInput = {
            root: computedRoot,
            nullifierHash: nullifierForWrongSecret,
            proposalId: 1,
            secret: wrongSecret,
            pathElements: elements,
            pathIndices: indices,
            vote: 1
        };

        try {
            await voteCircuit.calculateWitness(badInput, true);
            expect.fail("Expected failure due to secret mismatch");
        } catch (err: any) {
            expect(err.message).to.include("Error");
        }
    });

    it("Should reject a tampered Merkle path", async function () {
        const { computedRoot, elements, indices } = buildMockMembershipProof(20, 12345n, 0);

        // Corrupt the path mid-way.
        elements[5] = 12345678n;

        const input = {
            root: computedRoot,
            nullifierHash: computeHash([12345n, 1n]),
            proposalId: 1,
            secret: 12345n,
            pathElements: elements,
            pathIndices: indices,
            vote: 1
        };

        try {
            await voteCircuit.calculateWitness(input, true);
            expect.fail("Expected failure due to tampered path");
        } catch (err: any) {
            expect(err.message).to.include("Error");
        }
    });

    it("Should reject invalid vote values (range constraint)", async function () {
        const { computedRoot, elements, indices } = buildMockMembershipProof(20, 12345n, 0);

        const input = {
            root: computedRoot,
            nullifierHash: computeHash([12345n, 1n]),
            proposalId: 1,
            secret: 12345n,
            pathElements: elements,
            pathIndices: indices,
            vote: 10 // ILLEGAL VALUE (must be 0 or 1)
        };

        try {
            await voteCircuit.calculateWitness(input);
            expect.fail("Expected failure for out-of-range vote value");
        } catch (err: any) {
            expect(err.message).to.contain("Assert Failed");
        }
    });
});
