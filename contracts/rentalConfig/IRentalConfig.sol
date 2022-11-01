// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <0.9.0;

interface IRentalConfig {
    struct Config {
        address admin;
        address tempAdmin;
        address beneficiary;
        uint16 fee;
        uint40 cycle;
        uint40 maxLendingDuration;
    }

    event UpdateAdmin(address originalNFT, address admin);

    event UpdateConfig(
        address originalNFT,
        address beneficiary,
        uint16 fee,
        uint40 cycle,
        uint40 maxLendingDuration
    );

    function setTempAdmin(address originalNFT_, address tempAdmin_) external;

    function claimAdmin(address originalNFT_) external;

    function resetAdmin(address originalNFT_,address newAdmin_) external;

    function initConfig(
        address originalNFT_,
        address admin_,
        address payable beneficiary_,
        uint16 fee_,
        uint40 cycle_,
        uint40 maxDuration_
    ) external;

    function setConfig(
        address originalNFT_,
        address payable beneficiary_,
        uint16 fee_,
        uint40 cycle_,
        uint40 maxDuration_
    ) external;

    function getConfig(address originalNFT_)
        external
        view
        returns (Config memory config);
}
