// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoseidon {
    function poseidon(uint256[2] memory inputs) external view returns (uint256);
}
