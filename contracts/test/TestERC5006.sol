// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import "../erc1155/ERC5006.sol";

contract TestERC5006 is ERC5006 {
    constructor(string memory uri_, uint8 recordLimit_)
        ERC5006(uri_, recordLimit_)
    {}

    function mint(
        address to,
        uint256 id,
        uint256 amount
    ) public {
        _mint(to, id, amount, "");
    }

    function burn(
        address from,
        uint256 id,
        uint256 amount
    ) public {
        _burn(from, id, amount);
    }

}
