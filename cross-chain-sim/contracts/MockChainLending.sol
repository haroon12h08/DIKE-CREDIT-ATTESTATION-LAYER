// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDIKE
 * @notice Minimal interface to the DIKE / MockDIKERegistry.
 */
interface IDIKE {
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
        );

    function recordBorrow(address user, uint256 amount) external;
    function recordOnTimeRepay(address user, uint256 amount) external;
}

/**
 * @title MockChainLending
 * @notice Simulates a per-chain lending contract.
 *
 * Three instances are deployed to represent Chain A (Ethereum),
 * Chain B (Polygon), and Chain C (BNB).
 *
 * Without DIKE → collateral ratio always 150% (local history only)
 * With    DIKE → queries global registry; strong borrowers get 120%
 *
 * No collateral depositing, no interest. Pure ratio demonstration.
 */
contract MockChainLending {
    // ──────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────

    address public owner;
    string  public chainName;
    IDIKE   public dike;
    bool    public useDIKE;

    uint256 public constant BASE_RATIO      = 150; // 150%
    uint256 public constant PREFERRED_RATIO = 120; // 120% with DIKE

    mapping(address => uint256) public localBorrowed;
    mapping(address => uint256) public localRepaid;
    mapping(address => uint256) public activeLoan;

    // ──────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────

    event Borrow(address indexed user, uint256 amount, uint256 ratioApplied, bool dikeUsed);
    event Repay(address indexed user, uint256 amount);
    event DIKEToggled(bool enabled);

    // ──────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────

    constructor(string memory _chainName, address _dikeAddress) {
        owner     = msg.sender;
        chainName = _chainName;
        if (_dikeAddress != address(0)) {
            dike = IDIKE(_dikeAddress);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Core
    // ──────────────────────────────────────────────────────────────

    /**
     * @notice Borrow ETH from the chain's pool.
     *         Simulates ratio-check only — no collateral deposit required.
     */
    function borrow(uint256 amount) external payable {
        require(amount > 0,              "Amount must be > 0");
        require(activeLoan[msg.sender] == 0, "Repay existing loan first");

        uint256 ratio = _getRequiredRatio(msg.sender);

        // For simplicity we just record the loan — no actual ETH transfer.
        localBorrowed[msg.sender] += amount;
        activeLoan[msg.sender]     = amount;

        // Write to DIKE registry if enabled
        if (useDIKE && address(dike) != address(0)) {
            dike.recordBorrow(msg.sender, amount);
        }

        emit Borrow(msg.sender, amount, ratio, useDIKE);
    }

    /**
     * @notice Repay the active loan.
     *         Updates global DIKE registry when enabled.
     */
    function repay(uint256 amount) external {
        require(activeLoan[msg.sender] > 0, "No active loan");

        uint256 loan = activeLoan[msg.sender];
        uint256 repaid = amount > loan ? loan : amount;

        localRepaid[msg.sender]    += repaid;
        activeLoan[msg.sender]      = 0;

        // Propagate to DIKE
        if (useDIKE && address(dike) != address(0)) {
            dike.recordOnTimeRepay(msg.sender, repaid);
        }

        emit Repay(msg.sender, repaid);
    }

    /**
     * @notice Owner toggles DIKE-assisted underwriting.
     */
    function toggleDIKE(bool enabled) external {
        require(msg.sender == owner, "Not owner");
        require(address(dike) != address(0), "DIKE not configured");
        useDIKE = enabled;
        emit DIKEToggled(enabled);
    }

    // ──────────────────────────────────────────────────────────────
    // Views
    // ──────────────────────────────────────────────────────────────

    /**
     * @notice Returns the ratio CURRENTLY applied to borrow calls for `user`.
     */
    function getRequiredRatioFor(address user) external view returns (uint256) {
        return _getRequiredRatio(user);
    }

    /**
     * @notice Minimum collateral (or capital) required to borrow `amount`.
     */
    function getRequiredCollateral(address user, uint256 amount)
        external view returns (uint256)
    {
        return (amount * _getRequiredRatio(user)) / 100;
    }

    // ──────────────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────────────

    function _getRequiredRatio(address user) internal view returns (uint256) {
        if (!useDIKE || address(dike) == address(0)) {
            return BASE_RATIO; // 150
        }

        (
            ,
            ,
            uint256 defaultCount,
            uint256 onTimeCount,
            ,
            ,

        ) = dike.getCreditSummary(user);

        if (onTimeCount >= 5 && defaultCount == 0) {
            return PREFERRED_RATIO; // 120
        }
        return BASE_RATIO; // 150
    }

    // Accept ETH for gas-free demo funding
    receive() external payable {}
}
