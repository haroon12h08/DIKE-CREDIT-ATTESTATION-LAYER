// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDIKERegistry {
    enum EventType {
        BORROW,
        REPAY_ON_TIME,
        REPAY_LATE,
        DEFAULT
    }

    function recordEvent(
        address subject,
        uint256 amount,
        EventType eventType,
        bytes32 referenceHash
    ) external;
}
