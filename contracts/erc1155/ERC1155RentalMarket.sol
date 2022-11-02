// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./IERC1155RentalMarket.sol";
import "../rentalConfig/IRentalConfig.sol";
import "../baseMarket/BaseMarketUpgradeable.sol";

contract ERC1155RentalMarket is
    ERC1155Receiver,
    BaseMarketUpgradeable,
    IERC1155RentalMarket
{
    uint64 private constant E5 = 1e5;
    mapping(bytes32 => Lending) internal lendingMap;
    mapping(uint256 => Renting) internal rentingMap;
    mapping(address => address) internal original_wrapped;
    address public wrapERC1155Impl;
    uint256 private _curRentingId;

    function initialize(
        address owner_,
        address admin_,
        address payable beneficiary_,
        address wrapERC1155Impl_,
        IRentalConfig rentalConfig_
    ) public initializer {
        __BaseMarket_init(owner_, admin_, beneficiary_, 2500, rentalConfig_);
        wrapERC1155Impl = wrapERC1155Impl_;
    }

    function createLending(
        address nftAddress,
        uint256 nftId,
        uint64 amount,
        uint64 expiry,
        uint96 pricePerDay,
        address paymentToken,
        address renter
    ) external whenNotPaused {
        IRentalConfig.Config memory _config = rentalConfig.getConfig(
            nftAddress
        );
        require(
            expiry <= block.timestamp + _config.maxLendingDuration,
            "invalid expiry"
        );
        bytes32 lendingId = keccak256(
            abi.encodePacked(nftAddress, nftId, msg.sender)
        );
        Lending storage lending = lendingMap[lendingId];
        lending.lender = msg.sender;
        lending.nftAddress = nftAddress;
        lending.nftId = nftId;
        lending.amount = amount;
        lending.expiry = expiry;
        lending.pricePerDay = pricePerDay;
        lending.paymentToken = paymentToken;
        lending.renter = renter;

        emit UpdateLending(
            lendingId,
            nftId,
            nftAddress,
            amount,
            msg.sender,
            renter,
            expiry,
            paymentToken,
            pricePerDay
        );
    }

    function cancelLending(bytes32 lendingId) external whenNotPaused {
        require(lendingMap[lendingId].lender == msg.sender, "not lender");
        lendingMap[lendingId].expiry = 0;
        emit CancelLending(lendingId);
    }

    function lendingOf(bytes32 lendingId)
        external
        view
        returns (Lending memory)
    {
        return lendingMap[lendingId];
    }

    function rentingOf(uint256 rentingId)
        external
        view
        returns (Renting memory)
    {
        return rentingMap[rentingId];
    }

    function recordOf(uint256 rentingId)
        external
        view
        returns (IERC5006.UserRecord memory)
    {
        Renting storage renting = rentingMap[rentingId];
        require(renting.recordId != 0, "Nonexistent Record");
        Lending storage lending = lendingMap[renting.lendingId];

        bool is5006 = IERC165(lending.nftAddress).supportsInterface(
            type(IERC5006).interfaceId
        );
        if (is5006) {
            return IERC5006(lending.nftAddress).userRecordOf(renting.recordId);
        } else {
            address wNFT = original_wrapped[lending.nftAddress];
            return IERC5006(wNFT).userRecordOf(renting.recordId);
        }
    }

    function _befourRent(
        bytes32 lendingId,
        uint64 amount,
        uint64 cycleAmount,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) internal returns (uint64 expiry) {
        Lending storage lending = lendingMap[lendingId];
        require(lending.expiry >= block.timestamp, "has expired");
        IRentalConfig.Config memory _config = rentalConfig.getConfig(
            lending.nftAddress
        );
        uint64 duration = _config.cycle * cycleAmount;
        expiry = uint64(block.timestamp) + duration;
        require(expiry <= lending.expiry, "invalid expiry");
        require(
            paymentToken == lending.paymentToken &&
                pricePerDay == lending.pricePerDay,
            "invalid lending"
        );
        if (lending.renter != address(0)) {
            require(msg.sender == lending.renter, "invalid renter");
        }
        require(
            lending.amount >= lending.frozen &&
                amount <= lending.amount - lending.frozen,
            "insufficient remaining amount"
        );
        IERC1155(lending.nftAddress).safeTransferFrom(
            lending.lender,
            address(this),
            lending.nftId,
            amount,
            ""
        );
        lending.frozen += amount;
        distributePayment(
            lendingId,
            amount,
            duration,
            lending.nftAddress,
            2500
        );
        _curRentingId++;
        emit Rent(
            lendingId,
            _curRentingId,
            lending.nftId,
            lending.nftAddress,
            amount,
            to,
            duration,
            paymentToken,
            pricePerDay
        );
    }

    function rent5006(
        bytes32 lendingId,
        uint64 amount,
        uint64 cycleAmount,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) public payable whenNotPaused nonReentrant {
        uint64 expiry = _befourRent(
            lendingId,
            amount,
            cycleAmount,
            to,
            paymentToken,
            pricePerDay
        );
        Lending storage lending = lendingMap[lendingId];
        uint256 recordId = IERC5006(lending.nftAddress).createUserRecord(
            address(this),
            to,
            lending.nftId,
            amount,
            expiry
        );
        rentingMap[_curRentingId] = Renting(lendingId, recordId);
    }

    function rent1155(
        bytes32 lendingId,
        uint64 amount,
        uint64 cycleAmount,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) public payable whenNotPaused nonReentrant {
        uint64 expiry = _befourRent(
            lendingId,
            amount,
            cycleAmount,
            to,
            paymentToken,
            pricePerDay
        );
        Lending storage lending = lendingMap[lendingId];
        address wNFT = original_wrapped[lending.nftAddress];
        uint256 recordId = IWrappedInERC5006(wNFT).stakeAndCreateUserRecord(
            lending.nftId,
            amount,
            to,
            expiry
        );
        rentingMap[_curRentingId] = Renting(lendingId, recordId);
    }

    function clearRenting5006(uint256[] calldata rentingIds) public {
        for (uint256 i = 0; i < rentingIds.length; i++) {
            uint256 rentingId = rentingIds[i];
            Renting storage renting = rentingMap[rentingId];
            Lending storage lending = lendingMap[renting.lendingId];
            IERC5006.UserRecord memory record = IERC5006(lending.nftAddress)
                .userRecordOf(renting.recordId);
            require(record.expiry <= block.timestamp, "Not yet expired");
            IERC5006(lending.nftAddress).deleteUserRecord(renting.recordId);
            IERC1155(lending.nftAddress).safeTransferFrom(
                address(this),
                lending.lender,
                lending.nftId,
                record.amount,
                ""
            );
            lending.frozen -= record.amount;
            delete rentingMap[rentingId];
            emit ClearRent(rentingId);
        }
    }

    function clearRenting1155(uint256[] calldata rentingIds) public {
        for (uint256 i = 0; i < rentingIds.length; i++) {
            uint256 rentingId = rentingIds[i];
            Renting storage renting = rentingMap[rentingId];
            Lending storage lending = lendingMap[renting.lendingId];
            address wNFT = original_wrapped[lending.nftAddress];
            IERC5006.UserRecord memory record = IERC5006(wNFT).userRecordOf(
                renting.recordId
            );
            require(record.expiry <= block.timestamp, "Not yet expired");
            IWrappedInERC5006(wNFT).redeemRecord(
                renting.recordId,
                lending.lender
            );
            lending.frozen -= record.amount;
            delete rentingMap[rentingId];
            emit ClearRent(rentingId);
        }
    }

    function clearAndRent1155(
        uint256[] calldata rentingIds,
        bytes32 lendingId,
        uint64 amount,
        uint64 n,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) external payable{
        clearRenting1155(rentingIds);
        rent1155(lendingId, amount, n, to, paymentToken, pricePerDay);
    }
    function clearAndRent5006(
        uint256[] calldata rentingIds,
        bytes32 lendingId,
        uint64 amount,
        uint64 n,
        address to,
        address paymentToken,
        uint96 pricePerDay
    ) external payable{
        clearRenting5006(rentingIds);
        rent5006(lendingId, amount, n, to, paymentToken, pricePerDay);
    }

    function distributePayment(
        bytes32 lendingId,
        uint64 amount,
        uint256 duration,
        address nftAddress,
        uint16 royaltyFee
    )
        internal
        returns (
            uint256 totalPrice,
            uint256 leftTotalPrice,
            uint256 curFee,
            uint256 curRoyalty
        )
    {
        Lending storage lending = lendingMap[lendingId];
        if (lending.pricePerDay == 0) return (0, 0, 0, 0);
        totalPrice = ((lending.pricePerDay * uint256(amount) * duration) /
            86400);
        curFee = (totalPrice * fee) / E5;
        curRoyalty = 0;
        if (royaltyFee > 0) {
            curRoyalty = (totalPrice * royaltyFee) / E5;
            _balanceOfRoyalty[nftAddress][lending.paymentToken] += curRoyalty;
        }
        leftTotalPrice = totalPrice - curFee - curRoyalty;
        _balanceOfFee[lending.paymentToken] += curFee;
        if (lending.paymentToken == address(0)) {
            require(msg.value >= totalPrice, "payment is not enough");
            Address.sendValue(payable(lending.lender), leftTotalPrice);
            if (msg.value > totalPrice) {
                Address.sendValue(payable(msg.sender), msg.value - totalPrice);
            }
        } else {
            SafeERC20.safeTransferFrom(
                IERC20(lending.paymentToken),
                msg.sender,
                address(this),
                totalPrice
            );
            SafeERC20.safeTransfer(
                IERC20(lending.paymentToken),
                lending.lender,
                leftTotalPrice
            );
        }
    }

    function deployWrapERC1155(address nftAddress) external returns (address) {
        require(original_wrapped[nftAddress] == address(0), "deployed");
        address _wrap = Clones.clone(wrapERC1155Impl);
        IWrappedIn(_wrap).initializeWrap(nftAddress);
        original_wrapped[nftAddress] = _wrap;
        emit DeployWrapERC1155(nftAddress, _wrap);
        IERC1155(nftAddress).setApprovalForAll(_wrap, true);
        return _wrap;
    }

    function wNFTOf(address nftAddress) external view returns (address) {
        return original_wrapped[nftAddress];
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
