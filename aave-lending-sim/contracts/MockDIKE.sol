// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockDIKE
 * @notice Simulates the DIKE credit registry interface for demo purposes.
 *         Returns hardcoded credit profiles for two test addresses.
 *
 *         Strong Borrower → onTimeCount=10, defaultCount=0
 *         Weak   Borrower → onTimeCount=1,  defaultCount=2
 *         Everyone else   → neutral (onTimeCount=0, defaultCount=0)
 */
contract MockDIKE {
    // ──────────────────────────────
    // Configurable profiles (owner-settable for demo)
    // ──────────────────────────────
    address public owner;
    address public strongBorrower;
    address public weakBorrower;

    constructor(address _strongBorrower, address _weakBorrower) {
        owner = msg.sender;
        strongBorrower = _strongBorrower;
        weakBorrower   = _weakBorrower;
    }

    function setProfiles(address _strong, address _weak) external {
        require(msg.sender == owner, "Not owner");
        strongBorrower = _strong;
        weakBorrower   = _weak;
    }

    /**
     * @notice Returns a 7-value credit summary matching the IDIKE interface
     *         used by MockAaveLending.
     *
     * Return layout:
     *   totalBorrowed, totalRepaid, defaultCount,
     *   onTimeCount, lateCount, activeObligations, lastUpdated
     */
    function getCreditSummary(address user)
        external
        view
        returns (
            uint256 totalBorrowed,
            uint256 totalRepaid,
            uint256 defaultCount,
            uint256 onTimeCount,
            uint256 lateCount,
            uint256 activeObligations,
            uint256 lastUpdated
        )
    {
        if (user == strongBorrower) {
            return (
                10 ether,   // totalBorrowed
                10 ether,   // totalRepaid
                0,          // defaultCount  ✓
                10,         // onTimeCount   ✓ (≥5)
                0,          // lateCount
                0,          // activeObligations
                block.timestamp
            );
        } else if (user == weakBorrower) {
            return (
                5 ether,    // totalBorrowed
                2 ether,    // totalRepaid
                2,          // defaultCount  (>0)
                1,          // onTimeCount   (<5)
                1,          // lateCount
                3 ether,    // activeObligations
                block.timestamp
            );
        } else {
            // Neutral / unknown
            return (0, 0, 0, 0, 0, 0, 0);
        }
    }
}
