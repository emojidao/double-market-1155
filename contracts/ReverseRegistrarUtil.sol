// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Address.sol";
import "./OwnableUpgradeable.sol";

contract ReverseRegistrarUtil is OwnableUpgradeable {
    function ENS_setName(string memory name) public onlyAdmin {
        uint256 id;
        assembly {
            id := chainid()
        }
        bytes memory _data = abi.encodeWithSignature("setName(string)", name);
        if (id == 1) {
            Address.functionCall(
                address(0x084b1c3C81545d370f3634392De611CaaBFf8148),
                _data
            );
        } else if (id == 4) {
            Address.functionCall(
                address(0x6F628b68b30Dc3c17f345c9dbBb1E483c2b7aE5c),
                _data
            );
        }
    }
}
