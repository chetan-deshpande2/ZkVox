// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMembershipRegistry {
    function isKnownRoot(uint256 root) external view returns (bool);
    function root() external view returns (uint256);
}
