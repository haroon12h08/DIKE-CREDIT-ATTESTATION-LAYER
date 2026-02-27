export const DIKE_REGISTRY_ABI = [
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getCreditSummary",
        "outputs": [
            { "internalType": "uint256", "name": "totalBorrowed", "type": "uint256" },
            { "internalType": "uint256", "name": "totalRepaid", "type": "uint256" },
            { "internalType": "uint256", "name": "defaults", "type": "uint256" },
            { "internalType": "uint256", "name": "onTimeRepayments", "type": "uint256" },
            { "internalType": "uint256", "name": "lateRepayments", "type": "uint256" },
            { "internalType": "uint256", "name": "totalEvents", "type": "uint256" },
            { "internalType": "uint256", "name": "onTimeRatio", "type": "uint256" },
            { "internalType": "uint256", "name": "defaultRate", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getUserEvents",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getOutstandingDebt",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "ownerOf",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "eventId", "type": "uint256" }],
        "name": "getCreditEvent",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "subject", "type": "address" },
                    { "internalType": "uint256", "name": "amount", "type": "uint256" },
                    { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
                    { "internalType": "uint8", "name": "eventType", "type": "uint8" },
                    { "internalType": "bytes32", "name": "referenceHash", "type": "bytes32" }
                ],
                "internalType": "struct DIKERegistry.CreditEvent",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;
