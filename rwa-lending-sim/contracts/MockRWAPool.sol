// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDIKE
 * @notice Minimal interface to the DIKE credit registry (7-value variant).
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
 * @title MockRWAPool
 * @notice Minimal RWA-style uncollateralized lending pool simulation.
 *
 * Flow:
 *  1. Investors call invest() to fund the pool.
 *  2. A borrower calls requestLoan(amount).
 *  3. approveLoan() is called:
 *       - Without DIKE → owner approves manually (arbitrary / opaque).
 *       - With    DIKE → auto-approved if onTime ≥ 5 AND defaults == 0,
 *                        else auto-rejected.
 *  4. Borrower calls withdrawLoan() to pull capital.
 *  5. Borrower calls repayInstallment() repeatedly until fully repaid.
 *
 * No interest logic, no KYC, no ERC-20, no oracle.
 */
contract MockRWAPool {
    // ──────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────

    address public owner;
    IDIKE   public dike;
    bool    public useDIKE;

    // Investor accounting
    mapping(address => uint256) public investorDeposits;
    uint256 public totalPoolLiquidity;

    // Active loan state
    address public borrower;
    uint256 public borrowedAmount;
    uint256 public repaymentDue;     // principal × 110% — simulates 10% yield
    uint256 public repaymentsMade;
    bool    public loanApproved;
    bool    public loanWithdrawn;

    // ──────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────

    event Invested(address indexed investor, uint256 amount);
    event LoanRequested(address indexed borrower, uint256 amount);
    event LoanApproved(address indexed borrower, uint256 repaymentDue, bool viaDAIKE);
    event LoanRejected(address indexed borrower, string reason);
    event LoanWithdrawn(address indexed borrower, uint256 amount);
    event InstallmentRepaid(address indexed borrower, uint256 paid, uint256 remaining);
    event LoanFullyRepaid(address indexed borrower);
    event DIKEToggled(bool enabled);

    // ──────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────

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
    // Investor functions
    // ──────────────────────────────────────────────────────────────

    /**
     * @notice Investor deposits ETH into the pool.
     */
    function invest() external payable {
        require(msg.value > 0, "Must send ETH");
        investorDeposits[msg.sender] += msg.value;
        totalPoolLiquidity           += msg.value;
        emit Invested(msg.sender, msg.value);
    }

    // ──────────────────────────────────────────────────────────────
    // Borrower functions
    // ──────────────────────────────────────────────────────────────

    /**
     * @notice Borrower submits an uncollateralized loan request.
     *         No automatic approval — approveLoan() must be called next.
     */
    function requestLoan(uint256 amount) external {
        require(!loanApproved,           "A loan is already active");
        require(amount > 0,              "Amount must be > 0");
        require(amount <= totalPoolLiquidity, "Insufficient pool liquidity");

        borrower       = msg.sender;
        borrowedAmount = amount;
        repaymentDue   = 0;
        repaymentsMade = 0;
        loanApproved   = false;
        loanWithdrawn  = false;

        emit LoanRequested(msg.sender, amount);
    }

    /**
     * @notice Approve (or auto-screen) the pending loan request.
     *
     * Without DIKE → owner-only manual approval.
     * With    DIKE → automated:
     *   - onTimeCount ≥ 5 AND defaultCount == 0 → approved
     *   - otherwise → rejected
     */
    function approveLoan() external {
        require(borrowedAmount > 0,  "No loan request pending");
        require(!loanApproved,       "Already approved");

        if (!useDIKE) {
            // ── Manual underwriting (owner-only, opaque) ──────────
            require(msg.sender == owner, "Only owner can approve without DIKE");

            loanApproved = true;
            repaymentDue = (borrowedAmount * 110) / 100;

            emit LoanApproved(borrower, repaymentDue, false);

        } else {
            // ── DIKE-automated underwriting ───────────────────────
            require(address(dike) != address(0), "DIKE not configured");

            (
                ,
                ,
                uint256 defaultCount,
                uint256 onTimeCount,
                ,
                ,

            ) = dike.getCreditSummary(borrower);

            if (onTimeCount >= 5 && defaultCount == 0) {
                loanApproved = true;
                repaymentDue = (borrowedAmount * 110) / 100;

                emit LoanApproved(borrower, repaymentDue, true);
            } else {
                // Auto-reject: reset loan state
                address rejectedBorrower = borrower;
                borrower       = address(0);
                borrowedAmount = 0;

                emit LoanRejected(
                    rejectedBorrower,
                    "DIKE: insufficient credit history (onTime < 5 or defaults > 0)"
                );
            }
        }
    }

    /**
     * @notice Borrower withdraws approved funds from the pool.
     */
    function withdrawLoan() external {
        require(msg.sender == borrower, "Not the borrower");
        require(loanApproved,           "Loan not approved");
        require(!loanWithdrawn,         "Already withdrawn");
        require(address(this).balance >= borrowedAmount, "Insufficient ETH in pool");

        loanWithdrawn       = true;
        totalPoolLiquidity -= borrowedAmount;

        (bool sent, ) = msg.sender.call{value: borrowedAmount}("");
        require(sent, "ETH transfer failed");

        emit LoanWithdrawn(msg.sender, borrowedAmount);
    }

    /**
     * @notice Borrower sends an ETH repayment installment.
     *         Any amount accepted; loan clears when repaymentsMade >= repaymentDue.
     */
    function repayInstallment() external payable {
        require(msg.sender == borrower, "Not the borrower");
        require(loanApproved,           "No active loan");
        require(loanWithdrawn,          "Loan not yet withdrawn");
        require(msg.value > 0,          "Send ETH to repay");

        repaymentsMade     += msg.value;
        totalPoolLiquidity += msg.value;

        if (repaymentsMade >= repaymentDue) {
            // Loan fully repaid — reset state
            emit InstallmentRepaid(msg.sender, msg.value, 0);
            emit LoanFullyRepaid(msg.sender);

            borrower       = address(0);
            borrowedAmount = 0;
            repaymentDue   = 0;
            repaymentsMade = 0;
            loanApproved   = false;
            loanWithdrawn  = false;
        } else {
            uint256 remaining = repaymentDue - repaymentsMade;
            emit InstallmentRepaid(msg.sender, msg.value, remaining);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Admin functions
    // ──────────────────────────────────────────────────────────────

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
     * @notice Returns remaining repayment balance.
     */
    function remainingRepayment() external view returns (uint256) {
        if (repaymentsMade >= repaymentDue) return 0;
        return repaymentDue - repaymentsMade;
    }

    /**
     * @notice Returns a DIKE-based approval prediction for a given address
     *         (view-only, for UI display).
     */
    function dikeWouldApprove(address user) external view returns (bool) {
        if (!useDIKE || address(dike) == address(0)) return false;
        (
            ,
            ,
            uint256 defaultCount,
            uint256 onTimeCount,
            ,
            ,

        ) = dike.getCreditSummary(user);
        return (onTimeCount >= 5 && defaultCount == 0);
    }

    // Allow contract to receive ETH (from repayments flowing back in)
    receive() external payable {}
}
