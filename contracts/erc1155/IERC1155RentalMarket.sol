// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <0.9.0;

import "./IWrappedInERC5006.sol";

interface IERC1155RentalMarket {
    struct Lending {
        uint256 nftId;
        address nftAddress;
        uint64 amount;
        address lender;
        uint64 frozen;
        address renter;
        uint64 expiry;
        address paymentToken;
        uint96 pricePerDay;
    }

    struct Renting {
        bytes32 lendingId;
        uint256 recordId;
    }

    event UpdateLending(
        bytes32 lendingId,
        uint256 nftId,
        address nftAddress,
        uint64 amount,
        address lender,
        address renter,
        uint64 expiry,
        address paymentToken,
        uint96 pricePerDay
    );

    event CancelLending(bytes32 lendingId);

    event Rent(
        bytes32 lendingId,
        uint256 rentingId,
        uint256 nftId,
        address nftAddress,
        uint64 amount,
        address to,
        uint64 duration,
        address paymentToken,
        uint96 pricePerDay
    );
    event ClearRent(uint256 rentingId);

    event DeployWrapERC5006(address oNFT, address wNFT);

    function createLending(
        address nftAddress,
        uint256 nftId,
        uint64 amount,
        uint64 expiry,
        uint96 pricePerDay,
        address paymentToken,
        address renter
    ) external;

    function cancelLending(bytes32 lendingId) external;

    function clearRenting5006(uint256[] calldata rentingIds) external;

    function clearRenting1155(uint256[] calldata rentingIds) external;

    function lendingOf(bytes32 lendingId)
        external
        view
        returns (Lending memory);

    function rentingOf(uint256 rentingId)
        external
        view
        returns (Renting memory);

    function recordOf(uint256 rentingId)
        external
        view
        returns (IERC5006.UserRecord memory);

    function rent5006(
        bytes32 lendingId,
        uint64 amount,
        uint64 cycleAmount,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) external payable;

    function rent1155(
        bytes32 lendingId,
        uint64 amount,
        uint64 cycleAmount,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) external payable;

    function wNFTOf(address nftAddress) external view returns (address);

}
