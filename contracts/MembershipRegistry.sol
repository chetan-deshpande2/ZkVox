// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPoseidon.sol";

/**
 * @title MembershipRegistry
 * @notice Manages an on-chain incremental Merkle tree for DAO membership.
 */
contract MembershipRegistry {
    uint256 public constant TREE_DEPTH = 20;
    uint256 public constant MAX_MEMBERS = 1048576; // 2^20

    IPoseidon public immutable poseidon;
    uint256 public root;
    uint256 public nextIndex;

    // History of valid roots to allow voting even if the root was recently updated
    mapping(uint256 => bool) public isKnownRoot;

    // Pre-calculated zero values for each level
    uint256[TREE_DEPTH] public zeros;
    // Current filled subtrees for each level
    uint256[TREE_DEPTH] public filledSubtrees;

    event MemberAdded(uint256 indexed index, uint256 commitment, uint256 root);

    /**
     * @param _poseidon Address of the Poseidon hash contract
     * @param _emptyLeaf The value of an empty leaf (usually H("empty"))
     */
    constructor(address _poseidon, uint256 _emptyLeaf) {
        poseidon = IPoseidon(_poseidon);

        uint256 currentZero = _emptyLeaf;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = currentZero;
            filledSubtrees[i] = currentZero;
            currentZero = _hash([currentZero, currentZero]);
        }
        root = currentZero;
        isKnownRoot[root] = true;
    }

    /**
     * @notice Adds a new member to the DAO by inserting their identity commitment.
     * @param commitment The identity commitment (Poseidon hash of witness).
     */
    function register(uint256 commitment) external {
        require(nextIndex < MAX_MEMBERS, "Registry: Tree is full");

        uint256 currentIndex = nextIndex;
        nextIndex++;

        uint256 currentLevelHash = commitment;
        uint256 left;
        uint256 right;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                filledSubtrees[i] = currentLevelHash;
                // If it's the left child, we don't need to re-hash everything yet,
                // but we need to proceed to the next layer with the new branch.
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = _hash([left, right]);
            currentIndex /= 2;
        }

        root = currentLevelHash;
        isKnownRoot[root] = true;
        emit MemberAdded(nextIndex - 1, commitment, root);
    }

    function _hash(uint256[2] memory inputs) internal view returns (uint256) {
        return poseidon.poseidon(inputs);
    }
}
