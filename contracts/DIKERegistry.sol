// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title DIKERegistry
 * @notice Standard protocol registry for verifiable DIKE Credit Events.
 * @dev Issues NFT receipts for credit events. Inherits from ERC721 and Ownable.
 */
contract DIKERegistry is ERC721, Ownable {
    /**
     * @dev Defines the nature of the credit event being registered.
     */
    enum EventType {
        BORROW,
        REPAY_ON_TIME,
        REPAY_LATE,
        DEFAULT
    }

    /**
     * @dev A full record of a specific credit action on the protocol.
     */
    struct CreditEvent {
        address subject;
        uint256 amount;
        uint256 timestamp;
        EventType eventType;
        bytes32 referenceHash;
    }

    /**
     * @dev Cumulative credit statistics for an individual user identity.
     */
    struct UserTotals {
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 defaults;
        uint256 onTimeRepayments;
        uint256 lateRepayments;
        uint256 totalEvents;
    }

    /// @notice Auto-incrementing identifier for the next credit event.
    uint256 public nextEventId;

    /// @notice Maps a unique event ID to its full CreditEvent details.
    mapping(uint256 => CreditEvent) public creditEvents;

    /// @dev Maps a user address to an array of standard event IDs they are associated with.
    mapping(address => uint256[]) private userEventIds;

    /// @notice Maps a user address to their aggregated lifecycle credit statistics.
    mapping(address => UserTotals) public userTotals;

    /**
     * @notice Emitted when a new verifiable credit event is registered.
     * @param eventId The globally unique identifier of this event and corresponding NFT receipt.
     * @param subject The on-chain identity the event is recorded for.
     * @param eventType The categorical nature of the event.
     * @param amount The principal value associated with the event.
     */
    event CreditEventRecorded(
        uint256 indexed eventId,
        address indexed subject,
        EventType eventType,
        uint256 amount
    );

    /**
     * @notice Initializes the token collection and sets the administrative owner.
     * @param initialOwner The address of the initial contract owner.
     */
    constructor(address initialOwner) 
        ERC721("DIKE Credit Event", "DIKE") 
        Ownable(initialOwner) 
    {}

    /**
     * @notice Records a new credit event on-chain, updating statistics and issuing an NFT receipt.
     * @dev Caller must be the owner (e.g., protocol forwarder contract).
     * @param subject The user address the event pertains to.
     * @param amount The nominal value amount of the event.
     * @param eventType The specific categorisation of the event.
     * @param referenceHash Off-chain proof or receipt identifier for verification.
     */
    function recordEvent(
        address subject,
        uint256 amount,
        EventType eventType,
        bytes32 referenceHash
    ) external onlyOwner {
        require(subject != address(0), "Invalid subject: zero address");
        require(amount > 0, "Amount must be strictly positive");

        uint256 eventId = nextEventId++;

        creditEvents[eventId] = CreditEvent({
            subject: subject,
            amount: amount,
            timestamp: block.timestamp,
            eventType: eventType,
            referenceHash: referenceHash
        });

        userEventIds[subject].push(eventId);

        UserTotals storage totals = userTotals[subject];
        if (eventType == EventType.BORROW) {
            totals.totalBorrowed += amount;
        } else if (eventType == EventType.REPAY_ON_TIME) {
            totals.totalRepaid += amount;
            totals.onTimeRepayments++;
        } else if (eventType == EventType.REPAY_LATE) {
            totals.totalRepaid += amount;
        } else if (eventType == EventType.DEFAULT) {
            totals.defaults++;
        }

        _mint(subject, eventId);

        emit CreditEventRecorded(eventId, subject, eventType, amount);
    }

    /**
     * @notice Retrieves all event IDs associated with a specific user.
     * @param user The address of the user to query.
     * @return An array of unique event IDs.
     */
    function getUserEvents(address user) external view returns (uint256[] memory) {
        return userEventIds[user];
    }

    /**
     * @notice Retrieves the full details of a specific credit event.
     * @param eventId The globally unique identifier of the event.
     * @return The complete CreditEvent struct.
     */
    function getCreditEvent(uint256 eventId) external view returns (CreditEvent memory) {
        require(eventId < nextEventId, "Event does not exist");
        return creditEvents[eventId];
    }

    /**
     * @notice Generates the dynamic metadata URI for a given token ID.
     * @param tokenId The identifier of the token/event to query.
     * @return A Base64-encoded data URI containing JSON metadata.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < nextEventId, "Event does not exist");
        
        CreditEvent memory evt = creditEvents[tokenId];
        
        string memory json = string(
            abi.encodePacked(
                '{"name": "DIKE Credit Event #', Strings.toString(tokenId), '",',
                '"description": "On-chain verifiable credit event",',
                '"attributes": [',
                    '{"trait_type": "Subject", "value": "', Strings.toHexString(uint160(evt.subject), 20), '"},',
                    '{"trait_type": "Amount", "value": "', Strings.toString(evt.amount), '"},',
                    '{"trait_type": "Event Type", "value": "', Strings.toString(uint256(evt.eventType)), '"},',
                    '{"trait_type": "Timestamp", "display_type": "date", "value": ', Strings.toString(evt.timestamp), '},',
                    '{"trait_type": "Reference Hash", "value": "', Strings.toHexString(uint256(evt.referenceHash), 32), '"}'
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }
}
