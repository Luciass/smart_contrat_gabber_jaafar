// SPDX-License-Identifier: UTBM
pragma solidity >=0.8.0 <0.9.0;

contract Bonjour {
    string message;

    constructor(string memory initialMessage) {
        message = initialMessage;
    }

    function setBonjour(string memory newMessage) public {
        message = newMessage;
    }

    function getBonjour() public view returns (string memory) {
        return message;
    }
}
