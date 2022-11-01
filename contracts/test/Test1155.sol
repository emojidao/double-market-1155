// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract Test1155 is ERC1155 {
    constructor() ERC1155("") {}

    function mint(address to, uint256 tokenId,uint256 amount) public {
        _mint(to, tokenId, amount, "");
    }
}
