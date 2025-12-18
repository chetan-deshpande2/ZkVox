pragma circom 2.0.0;

/**
 * Standard Merkle Tree logic for zk-SNARKs.
 * Uses Poseidon hashing due to its low constraint count on-chain.
 */
include "../node_modules/circomlib/circuits/poseidon.circom";

// nLevels determines the maximum size of the tree (2^nLevels members).
template MerkleTreeInclusion(nLevels) {
    signal input leaf;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels]; // Binary array: 0 for left, 1 for right
    signal output root;

    component poseidons[nLevels];
    
    signal currentHash[nLevels + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < nLevels; i++) {
        // Simple sanity check: index must be binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        poseidons[i] = Poseidon(2);

        /**
         * We need to hash (L, R) in the correct order.
         * If index=0, currentHash is on the left.
         * If index=1, currentHash is on the right.
         */
        var L = currentHash[i] + (pathElements[i] - currentHash[i]) * pathIndices[i];
        var R = pathElements[i] + (currentHash[i] - pathElements[i]) * pathIndices[i];
        
        poseidons[i].inputs[0] <== L;
        poseidons[i].inputs[1] <== R;

        currentHash[i+1] <== poseidons[i].out;
    }

    // The final result is the computed tree root.
    root <== currentHash[nLevels];
}

/**
 * Main Voting Circuit.
 * Verifies that:
 * 1. The voter is part of the Merkle tree (Membership Proof).
 * 2. The nullifier is valid (Double voting prevention).
 * 3. The vote choice is valid (0 or 1).
 */
template Vote(nLevels) {
    // Public Inputs (Verifier sees these)
    signal input root;
    signal input nullifierHash;
    signal input proposalId;
    signal input vote; // 0 or 1

    // Private Inputs (Voter keeps these secret)
    signal input secret;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels];

    // -- Step 1: Verify identity commitment --
    // commitment = Poseidon(secret)
    component commitmentHasher = Poseidon(1);
    commitmentHasher.inputs[0] <== secret;
    signal identityCommitment <== commitmentHasher.out;

    // -- Step 2: Verify membership in the tree --
    component merkeProof = MerkleTreeInclusion(nLevels);
    merkeProof.leaf <== identityCommitment;
    for (var i = 0; i < nLevels; i++) {
        merkeProof.pathElements[i] <== pathElements[i];
        merkeProof.pathIndices[i] <== pathIndices[i];
    }

    // Constraint: The computed root must match the public root provided.
    root === merkeProof.root;

    // -- Step 3: Compute Nullifier --
    // Nullifier = Poseidon(secret, proposalId).
    // This allows one vote per identity per proposal, but keeps identity anonymous.
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== proposalId;

    nullifierHash === nullifierHasher.out;

    // -- Step 4: Validate Vote --
    // Enforce vote is strictly 0 (No) or 1 (Yes).
    vote * (1 - vote) === 0;

    // Create a circular constraint to ensure the 'vote' input is actually involved 
    // in the proof generation and not optimized away by the compiler.
    signal voteSquare <== vote * vote;
}

// 2^20 members is roughly 1 million.
component main {public [root, nullifierHash, proposalId, vote]} = Vote(20);
