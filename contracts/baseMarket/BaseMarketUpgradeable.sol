// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./IBaseMarket.sol";
import "../OwnableUpgradeable.sol";
import "../rentalConfig/IRentalConfig.sol";
import "../ReverseRegistrarUtil.sol";

contract BaseMarketUpgradeable is
    Multicall,
    ReentrancyGuardUpgradeable,
    ReverseRegistrarUtil,
    IBaseMarket
{
    mapping(address => mapping(address => uint256)) internal _balanceOfRoyalty;
    mapping(address => uint256) internal _balanceOfFee;
    address public beneficiary;
    uint16 public fee;
    bool public isPausing;
    IRentalConfig public rentalConfig;

    modifier whenNotPaused() {
        require(!isPausing, "is pausing");
        _;
    }

    function __BaseMarket_init(
        address owner_,
        address admin_,
        address payable beneficiary_,
        uint16 fee_,
        IRentalConfig rentalConfig_
    ) internal onlyInitializing {
        __ReentrancyGuard_init();
        initOwnableContract(owner_, admin_);
        beneficiary = beneficiary_;
        fee = fee_;
        rentalConfig = rentalConfig_;
    }

    function setFee(uint16 fee_) external onlyAdmin {
        require(fee_ <= 1e4, "invalid fee");
        fee = fee_;
    }

    function setBeneficiary(address beneficiary_) external onlyOwner {
        beneficiary = beneficiary_;
    }

    function claimFee(address[] calldata paymentTokens)
        external
        whenNotPaused
        nonReentrant
    {
        require(msg.sender == beneficiary, "not beneficiary");
        for (uint256 index = 0; index < paymentTokens.length; index++) {
            uint256 balance = _balanceOfFee[paymentTokens[index]];
            if (balance > 0) {
                if (paymentTokens[index] == address(0)) {
                    Address.sendValue(payable(beneficiary), balance);
                } else {
                    SafeERC20.safeTransfer(
                        IERC20(paymentTokens[index]),
                        beneficiary,
                        balance
                    );
                }
                _balanceOfFee[paymentTokens[index]] = 0;
            }
        }
    }

    function totalFee(address oNFT) external view returns (uint16) {
        return fee + rentalConfig.getConfig(oNFT).fee;
    }

    function balanceOfRoyalty(address oNFT, address[] calldata paymentTokens)
        external
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](paymentTokens.length);
        for (uint256 index = 0; index < paymentTokens.length; index++) {
            uint256 balance = _balanceOfRoyalty[oNFT][paymentTokens[index]];
            balances[index] = balance;
        }
    }

    function claimRoyalty(address oNFT, address[] calldata paymentTokens)
        external
        whenNotPaused
        nonReentrant
    {
        address _beneficiary = rentalConfig.getConfig(oNFT).beneficiary;
        require(msg.sender == _beneficiary, "not beneficiary");
        for (uint256 index = 0; index < paymentTokens.length; index++) {
            uint256 balance = _balanceOfRoyalty[oNFT][paymentTokens[index]];
            if (balance > 0) {
                if (paymentTokens[index] == address(0)) {
                    Address.sendValue(payable(_beneficiary), balance);
                } else {
                    SafeERC20.safeTransfer(
                        IERC20(paymentTokens[index]),
                        _beneficiary,
                        balance
                    );
                }
                _balanceOfRoyalty[oNFT][paymentTokens[index]] = 0;
            }
        }
    }

    function setPause(bool pause_) external onlyAdmin {
        isPausing = pause_;
        if (isPausing) {
            emit Paused(address(this));
        } else {
            emit Unpaused(address(this));
        }
    }
}
