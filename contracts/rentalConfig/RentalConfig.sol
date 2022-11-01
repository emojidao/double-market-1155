// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IRentalConfig.sol";
import "./IOwnable.sol";

contract RentalConfig is IRentalConfig, Initializable {
    mapping(address => Config) configMap;
    address public superAdmin;

    function initialize(address superAdmin_) public virtual initializer {
        superAdmin = superAdmin_;
    }

    modifier onlyAdmin(address originalNFT_) {
        require(
            msg.sender == superAdmin ||
                msg.sender == configMap[originalNFT_].admin,
            "only admin"
        );
        _;
    }

    function setTempAdmin(address originalNFT_, address tempAdmin_)
        external
        onlyAdmin(originalNFT_)
    {
        configMap[originalNFT_].tempAdmin = tempAdmin_;
    }

    function claimAdmin(address originalNFT_) public virtual {
        require(
            msg.sender == configMap[originalNFT_].tempAdmin,
            "only temp admin"
        );
        configMap[originalNFT_].admin = configMap[originalNFT_].tempAdmin;
        configMap[originalNFT_].tempAdmin = address(0);
        emit UpdateAdmin(originalNFT_, configMap[originalNFT_].admin);
    }

    function resetAdmin(address originalNFT_, address newAdmin_)
        public
        virtual
    {
        require(msg.sender == superAdmin, "only super admin");
        configMap[originalNFT_].admin = newAdmin_;
        emit UpdateAdmin(originalNFT_, newAdmin_);
    }

    function initConfig(
        address originalNFT_,
        address admin_,
        address payable beneficiary_,
        uint16 fee_,
        uint40 cycle_,
        uint40 maxLendingDuration_
    ) external {
        require(msg.sender == superAdmin, "only super admin");
        require(configMap[originalNFT_].admin == address(0), "inited alerady");
        require(fee_ <= 10000, "fee exceeds 10pct");
        require(
            cycle_ <= maxLendingDuration_,
            "Cycle time cannot be greater than maxLendingDuration"
        );
        // address config_admin;
        // try IOwnable(originalNFT_).owner() returns (address _owner) {
        //     config_admin = _owner;
        // } catch (bytes memory) {
        //     config_admin = admin_;
        // }
        configMap[originalNFT_] = Config(
            admin_,
            address(0),
            beneficiary_,
            fee_,
            cycle_,
            maxLendingDuration_
        );
        emit UpdateAdmin(originalNFT_, admin_);
        emit UpdateConfig(
            originalNFT_,
            beneficiary_,
            fee_,
            cycle_,
            maxLendingDuration_
        );
    }

    function setConfig(
        address originalNFT_,
        address payable beneficiary_,
        uint16 fee_,
        uint40 cycle_,
        uint40 maxLendingDuration_
    ) external onlyAdmin(originalNFT_) {
        require(fee_ <= 10000, "fee exceeds 10pct");
        require(
            cycle_ <= maxLendingDuration_,
            "Cycle time cannot be greater than maxLendingDuration"
        );
        configMap[originalNFT_].beneficiary = beneficiary_;
        configMap[originalNFT_].fee = fee_;
        configMap[originalNFT_].cycle = cycle_;
        configMap[originalNFT_].maxLendingDuration = maxLendingDuration_;
        emit UpdateConfig(
            originalNFT_,
            beneficiary_,
            fee_,
            cycle_,
            maxLendingDuration_
        );
    }

    function getConfig(address originalNFT_)
        external
        view
        returns (Config memory config)
    {
        return configMap[originalNFT_];
    }
}
