// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    uint8 internal _decimals ;
    constructor(string memory name_,string memory symbol_,uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amont) public {
        _mint(to, amont);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
