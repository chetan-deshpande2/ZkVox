// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZKVoxBadge
 * @notice A soulbound (non-transferable) token awarded to anonymous voters.
 */
contract ZKVoxBadge is ERC721, Ownable {
    uint256 private _nextTokenId;
    address public daoAddress;
    string private _baseTokenURI;

    error NotTransferable();
    error NotDAO();

    constructor()
        ERC721("ZKVox Participation Badge", "ZKVXB")
        Ownable(msg.sender)
    {
        _baseTokenURI = "https://metadata.zkvox.io/badge/";
    }

    /**
     * @dev Simple override to return a static/base URI.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    /**
     * @notice Set the DAO address that is allowed to mint badges.
     */
    function setDAOAddress(address _daoAddress) external onlyOwner {
        daoAddress = _daoAddress;
    }

    /**
     * @notice Mints a new badge to a specified recipient.
     * @dev Only the ZKDAO contract can call this.
     */
    function mint(address to) external returns (uint256) {
        if (msg.sender != daoAddress) revert NotDAO();

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /**
     * @notice Override to prevent transfers, making it soulbound.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Only allow minting (from == address(0)) or burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            revert NotTransferable();
        }

        return from;
    }
}
