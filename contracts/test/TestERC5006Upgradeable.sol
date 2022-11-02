// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/IERC1155MetadataURIUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../erc1155/ERC5006Upgradeable.sol";

contract TestERC5006Upgradeable is
    IERC1155MetadataURIUpgradeable,
    ERC5006Upgradeable
{
    using Strings for uint256;
    string internal _uri;

    function mint(
        address to,
        uint256 id,
        uint256 amount
    ) public virtual {
        _mint(to, id, amount, '');
    }

    function uri(uint256 id)
        public
        view
        override(IERC1155MetadataURIUpgradeable, ERC1155Upgradeable)
        returns (string memory)
    {
        return bytes(_uri).length > 0 ? string(abi.encodePacked(_uri, id.toString())) : "";
    }

    function setURI(string memory uri_) public {
        _uri = uri_;
    }
}
