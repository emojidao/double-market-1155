// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import "../erc1155/ERC5006Upgradeable.sol";

contract ERC5006UpgradeableDemo is ERC5006Upgradeable {

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
