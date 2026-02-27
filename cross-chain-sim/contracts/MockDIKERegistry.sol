// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockDIKERegistry
 * @notice Global cross-chain credit registry simulation.
 *
 * Any chain's lending contract can:
 *   - recordCreditEvent() to write a borrow/repay into the global ledger
 *   - getCreditSummary() to read the aggregated cross-chain history
 *
 * This collapses the "reputation silo" problem — one registry, all chains.
 */
contract MockDIKERegistry {
    address public owner;

    struct UserRecord {
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 defaultCount;
        uint256 onTimeCount;
        uint256 lateCount;
        uint256 lastUpdated;
    }

    mapping(address => UserRecord) private records;

    // Whitelist of chain contracts allowed to write events
    mapping(address => bool) public authorizedChains;

    // ── Events ────────────────────────────────────────────────────
    event CreditEventRecorded(address indexed user, string eventType, uint256 amount);
    event ChainAuthorized(address indexed chain);

    constructor() {
        owner = msg.sender;
    }

    // ── Admin ─────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function authorizeChain(address chainContract) external onlyOwner {
        authorizedChains[chainContract] = true;
        emit ChainAuthorized(chainContract);
    }

    // Open for simulation — any address can write
    // (in production this would be restricted to authorised cross-chain oracle)
    function recordBorrow(address user, uint256 amount) external {
        records[user].totalBorrowed += amount;
        records[user].lastUpdated    = block.timestamp;
        emit CreditEventRecorded(user, "BORROW", amount);
    }

    function recordOnTimeRepay(address user, uint256 amount) external {
        records[user].totalRepaid  += amount;
        records[user].onTimeCount  += 1;
        records[user].lastUpdated   = block.timestamp;
        emit CreditEventRecorded(user, "REPAY_ON_TIME", amount);
    }

    function recordDefault(address user) external {
        records[user].defaultCount += 1;
        records[user].lastUpdated   = block.timestamp;
        emit CreditEventRecorded(user, "DEFAULT", 0);
    }

    // Preset profiles for demo (owner-only)
    function setProfile(
        address user,
        uint256 totalBorrowed,
        uint256 totalRepaid,
        uint256 defaultCount,
        uint256 onTimeCount,
        uint256 lateCount
    ) external onlyOwner {
        records[user] = UserRecord({
            totalBorrowed:  totalBorrowed,
            totalRepaid:    totalRepaid,
            defaultCount:   defaultCount,
            onTimeCount:    onTimeCount,
            lateCount:      lateCount,
            lastUpdated:    block.timestamp
        });
    }

    // ── IDIKE-compatible read ─────────────────────────────────────

    /**
     * @notice Returns the 7-value credit summary (matches IDIKE interface).
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
        UserRecord storage r = records[user];
        return (
            r.totalBorrowed,
            r.totalRepaid,
            r.defaultCount,
            r.onTimeCount,
            r.lateCount,
            0,              // activeObligations — not tracked here
            r.lastUpdated
        );
    }
}
