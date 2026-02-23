// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface IDIKERegistry {
    struct CreditEvent {
        address subject;
        uint256 amount;
        uint8 eventType; 
        uint256 timestamp;
        bytes32 referenceHash;
    }

    struct UserTotals {
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 defaults;
        uint256 onTimeRepayments;
        uint256 lateRepayments;
        uint256 totalEvents;
    }

    function recordEvent(address subject, uint256 amount, uint8 eventType, bytes32 referenceHash) external;
    function getUserEvents(address user) external view returns (uint256[] memory);
    function getCreditEvent(uint256 eventId) external view returns (CreditEvent memory);
    function getCreditSummary(address user) external view returns (
        uint256 totalBorrowed,
        uint256 totalRepaid,
        uint256 defaults,
        uint256 onTimeRepayments,
        uint256 lateRepayments,
        uint256 totalEvents,
        uint256 onTimeRatio,
        uint256 defaultRate
    );
    function getOutstandingDebt(address user) external view returns (uint256);
}

contract DIKEUSCBridge is Ownable, Pausable {
    
    // ==========================================
    // STRUCTS
    // ==========================================

    struct RepaymentProof {
        address borrower;
        uint256 amount;
        uint256 sourceChainId;
        bytes32 sourceTxHash;
        address sourceProtocol;
        uint256 timestamp;
    }

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    IDIKERegistry public immutable dikeRegistry;
    mapping(bytes32 => bool) public processedProofs;

    // ==========================================
    // EVENTS
    // ==========================================

    event RepaymentVerified(
        address indexed borrower,
        uint256 amount,
        uint256 sourceChainId,
        bytes32 sourceTxHash
    );

    event BorrowVerified(
        address indexed borrower,
        uint256 amount,
        uint256 sourceChainId,
        bytes32 sourceTxHash
    );

    // ==========================================
    // ERRORS
    // ==========================================

    error ZeroRegistryAddress();
    error ZeroBorrowerAddress();
    error ZeroAmount();
    error ProofAlreadyProcessed();

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    constructor(address _dikeRegistryAddress) Ownable(msg.sender) {
        if (_dikeRegistryAddress == address(0)) revert ZeroRegistryAddress();
        dikeRegistry = IDIKERegistry(_dikeRegistryAddress);
    }

    // ==========================================
    // PAUSE / UNPAUSE (OWNER ONLY)
    // ==========================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==========================================
    // EXTERNAL FUNCTIONS
    // ==========================================

    function verifyAndRecordRepayment(RepaymentProof calldata proof) external onlyOwner whenNotPaused {
        if (proof.borrower == address(0)) revert ZeroBorrowerAddress();
        if (proof.amount == 0) revert ZeroAmount();
        if (processedProofs[proof.sourceTxHash]) revert ProofAlreadyProcessed();

        processedProofs[proof.sourceTxHash] = true;

        bytes32 referenceHash = keccak256(
            abi.encodePacked(
                proof.sourceChainId,
                proof.sourceTxHash,
                proof.sourceProtocol
            )
        );

        dikeRegistry.recordEvent(
            proof.borrower,
            proof.amount,
            1, // EventType.REPAY_ON_TIME
            referenceHash
        );

        emit RepaymentVerified(
            proof.borrower,
            proof.amount,
            proof.sourceChainId,
            proof.sourceTxHash
        );
    }

    function verifyAndRecordBorrow(
        address borrower,
        uint256 amount,
        uint256 sourceChainId,
        bytes32 sourceTxHash,
        address sourceProtocol
    ) external onlyOwner whenNotPaused {
        if (borrower == address(0)) revert ZeroBorrowerAddress();
        if (amount == 0) revert ZeroAmount();
        if (processedProofs[sourceTxHash]) revert ProofAlreadyProcessed();

        processedProofs[sourceTxHash] = true;

        bytes32 referenceHash = keccak256(
            abi.encodePacked(
                sourceChainId,
                sourceTxHash,
                sourceProtocol
            )
        );

        dikeRegistry.recordEvent(
            borrower,
            amount,
            0, // EventType.BORROW
            referenceHash
        );

        emit BorrowVerified(
            borrower,
            amount,
            sourceChainId,
            sourceTxHash
        );
    }
}
