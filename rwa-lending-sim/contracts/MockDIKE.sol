// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockDIKE
 * @notice Identical to the one used in aave-lending-sim.
 *         Returns hardcoded credit profiles for two test addresses.
 *
 *         Strong Borrower → onTimeCount=10, defaultCount=0
 *         Weak   Borrower → onTimeCount=1,  defaultCount=2
 */
contract MockDIKE {
    address public owner;
    address public strongBorrower;
    address public weakBorrower;

    constructor(address _strongBorrower, address _weakBorrower) {
        owner          = msg.sender;
        strongBorrower = _strongBorrower;
        weakBorrower   = _weakBorrower;
    }

    function setProfiles(address _strong, address _weak) external {
        require(msg.sender == owner, "Not owner");
        strongBorrower = _strong;
        weakBorrower   = _weak;
    }

    /**
     * @notice Returns 7-value credit summary (IDIKE interface).
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
            return (10 ether, 10 ether, 0, 10, 0, 0, block.timestamp);
        } else if (user == weakBorrower) {
            return (5 ether, 2 ether, 2, 1, 1, 3 ether, block.timestamp);
        } else {
            return (0, 0, 0, 0, 0, 0, 0);
        }
    }
}
