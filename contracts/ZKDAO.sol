// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IVerifier.sol";
import "./interfaces/IMembershipRegistry.sol";
import "./interfaces/IZKVoxBadge.sol";

/**
 * @title ZKDAO
 * @notice The main voting contract for ZKVox, featuring ZK-proof verification,
 * proposal metadata, and soulbound rewards.
 */
contract ZKDAO is Ownable {
    IVerifier public verifier;
    IMembershipRegistry public registry;
    IZKVoxBadge public badge;

    uint256 constant FIELD_PRIME =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        string title;
        string description;
        string ipfsLink;
        uint256 yesVotes;
        uint256 noVotes;
        bool exists;
        bool isClosed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => bool) public nullifiers;

    event VoteCast(uint256 indexed proposalId, uint256 vote, uint256 badgeId);
    event ProposalCreated(uint256 indexed proposalId, string title);

    constructor(
        address _verifier,
        address _registry,
        address _badge
    ) Ownable(msg.sender) {
        verifier = IVerifier(_verifier);
        registry = IMembershipRegistry(_registry);
        badge = IZKVoxBadge(_badge);
    }

    /**
     * @notice Allows creating a new proposal with rich metadata.
     */
    function createProposal(
        uint256 proposalId,
        string calldata title,
        string calldata description,
        string calldata ipfsLink
    ) external {
        require(!proposals[proposalId].exists, "DAO: Proposal already exists");

        proposals[proposalId] = Proposal({
            title: title,
            description: description,
            ipfsLink: ipfsLink,
            yesVotes: 0,
            noVotes: 0,
            exists: true,
            isClosed: false
        });

        emit ProposalCreated(proposalId, title);
    }

    /**
     * @notice Submit a privacy-preserving vote and claim a soulbound badge.
     * @param a, b, c The Groth16 proof components.
     * @param nullifierHash Unique hash for (identity, proposal) to prevent double voting.
     * @param proposalId The ID of the proposal being voted on.
     * @param root The Merkle root this proof was generated against.
     * @param vote The actual vote choice (1 for Yes, 0 for No).
     * @param badgeRecipient Address to receive the soulbound reward.
     */
    function castVote(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256 nullifierHash,
        uint256 proposalId,
        uint256 root,
        uint256 vote,
        address badgeRecipient
    ) external {
        require(proposals[proposalId].exists, "DAO: Proposal does not exist");
        require(!proposals[proposalId].isClosed, "DAO: Proposal is closed");
        require(nullifierHash < FIELD_PRIME, "Input overflow: nullifierHash");
        require(proposalId < FIELD_PRIME, "Input overflow: proposalId");
        require(root < FIELD_PRIME, "Input overflow: root");
        require(vote < FIELD_PRIME, "Input overflow: vote");

        // Logic check: Verify root against the membership registry history
        require(
            registry.isKnownRoot(root),
            "Registry: Root mismatch or expired"
        );

        require(!nullifiers[nullifierHash], "Security: Double voting detected");

        uint256[4] memory publicSignals = [
            root,
            nullifierHash,
            proposalId,
            vote
        ];

        require(
            verifier.verifyProof(a, b, c, publicSignals),
            "ZK Error: Proof verification failed"
        );

        nullifiers[nullifierHash] = true;

        if (vote == 1) {
            proposals[proposalId].yesVotes++;
        } else {
            proposals[proposalId].noVotes++;
        }

        // Mint reward badge (if recipient provided)
        uint256 badgeId = 0;
        if (address(badge) != address(0) && badgeRecipient != address(0)) {
            badgeId = badge.mint(badgeRecipient);
        }

        emit VoteCast(proposalId, vote, badgeId);
    }

    /**
     * @notice Helper to get vote counts for a proposal.
     */
    function getTally(
        uint256 proposalId
    ) external view returns (uint256 yes, uint256 no) {
        return (proposals[proposalId].yesVotes, proposals[proposalId].noVotes);
    }

    /**
     * @notice Allows the DAO owner to close a proposal and finalize results.
     */
    function closeProposal(uint256 proposalId) external onlyOwner {
        require(proposals[proposalId].exists, "DAO: Proposal does not exist");
        proposals[proposalId].isClosed = true;
    }
}
