// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLendingProtocol is Ownable {
    struct Loan {
        uint256 principal;
        uint256 borrowedAt;
        bool repaid;
    }

    IERC20 public immutable token;
    mapping(address => Loan[]) public userLoans;

    event LoanBorrowed(
        address indexed borrower,
        uint256 loanId,
        uint256 amount
    );

    event LoanRepaid(
        address indexed borrower,
        uint256 loanId,
        uint256 amount,
        uint256 timestamp
    );

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function fund(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than zero");
        require(token.transferFrom(msg.sender, address(this), amount), "Funding failed");
    }

    function borrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        
        uint256 loanId = userLoans[msg.sender].length;
        userLoans[msg.sender].push(Loan({
            principal: amount,
            borrowedAt: block.timestamp,
            repaid: false
        }));

        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit LoanBorrowed(msg.sender, loanId, amount);
    }

    function repay(uint256 loanId) external {
        require(loanId < userLoans[msg.sender].length, "Loan does not exist");
        Loan storage loan = userLoans[msg.sender][loanId];
        require(!loan.repaid, "Loan already repaid");

        loan.repaid = true;

        require(token.transferFrom(msg.sender, address(this), loan.principal), "Transfer failed");

        emit LoanRepaid(msg.sender, loanId, loan.principal, block.timestamp);
    }
}
