// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDIKE
 * @notice Minimal interface to the DIKE credit registry.
 *
 * Return order matches MockDIKE.getCreditSummary and the real DIKERegistry if
 * adapted — only the 7-field variant used in this simulation.
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
}

/**
 * @title MockAaveLending
 * @notice Minimal Aave-style overcollateralised lending simulation.
 *
 * Without DIKE  → required collateral = borrow × 150 %
 * With    DIKE  → strong borrower (onTime ≥ 5, defaults == 0)
 *                 gets 110 % ratio; everyone else stays at 150 %.
 *
 * No interest, no liquidation, no price oracle, no ERC-20 tokens.
 */
contract MockAaveLending {
    // ──────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────

    address public owner;
    IDIKE   public dike;

    mapping(address => uint256) public collateralDeposited;
    mapping(address => uint256) public borrowedAmount;

    uint256 public baseCollateralRatio      = 150; // 150 %
    uint256 public preferredCollateralRatio = 110; // 110 %
    bool    public useDIKE                  = false;

    // ──────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────

    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount, uint256 collateralRatioApplied);
    event Repay(address indexed user, uint256 amount);
    event DIKEToggled(bool enabled);

    // ──────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────

    /**
     * @param _dikeAddress Address of the DIKE registry (real or mock).
     *                     Pass address(0) to deploy without DIKE support.
     */
    constructor(address _dikeAddress) {
        owner = msg.sender;
        if (_dikeAddress != address(0)) {
            dike = IDIKE(_dikeAddress);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ──────────────────────────────────────────────────────────────
    // Core functions
    // ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ETH as collateral.
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit ETH");
        collateralDeposited[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Borrow ETH against deposited collateral.
     * @param amount Amount to borrow (in wei).
     */
    function borrow(uint256 amount) external {
        require(amount > 0,                       "Borrow amount must be > 0");
        require(borrowedAmount[msg.sender] == 0,  "Repay existing loan first");
        require(address(this).balance >= amount,  "Protocol has insufficient ETH");

        uint256 ratioApplied = _getRequiredRatio(msg.sender);
        uint256 requiredCollateral = (amount * ratioApplied) / 100;

        require(
            collateralDeposited[msg.sender] >= requiredCollateral,
            "Insufficient collateral"
        );

        borrowedAmount[msg.sender] = amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit Borrow(msg.sender, amount, ratioApplied);
    }

    /**
     * @notice Repay the full outstanding loan.
     */
    function repay() external payable {
        uint256 owed = borrowedAmount[msg.sender];
        require(owed > 0,          "No active loan");
        require(msg.value >= owed, "Must repay full amount");

        borrowedAmount[msg.sender] = 0;

        // Return any overpayment
        if (msg.value > owed) {
            (bool refund, ) = msg.sender.call{value: msg.value - owed}("");
            require(refund, "Refund failed");
        }

        emit Repay(msg.sender, owed);
    }

    /**
     * @notice Owner toggles DIKE-assisted underwriting on/off.
     */
    function toggleDIKE(bool enabled) external onlyOwner {
        require(address(dike) != address(0), "DIKE not configured");
        useDIKE = enabled;
        emit DIKEToggled(enabled);
    }

    // ──────────────────────────────────────────────────────────────
    // View helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * @notice Returns the collateral ratio that WILL be applied to a borrow call
     *         for `user` under the current protocol settings.
     */
    function getRequiredRatioFor(address user) external view returns (uint256) {
        return _getRequiredRatio(user);
    }

    /**
     * @notice Returns the minimum collateral required to borrow `amount` for `user`.
     */
    function getRequiredCollateral(address user, uint256 amount)
        external
        view
        returns (uint256)
    {
        return (amount * _getRequiredRatio(user)) / 100;
    }

    // ──────────────────────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────────────────────

    function _getRequiredRatio(address user) internal view returns (uint256) {
        if (!useDIKE || address(dike) == address(0)) {
            return baseCollateralRatio; // 150
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
            return preferredCollateralRatio; // 110
        }

        return baseCollateralRatio; // 150
    }

    // Allow protocol to receive ETH (liquidity top-up)
    receive() external payable {}
}
