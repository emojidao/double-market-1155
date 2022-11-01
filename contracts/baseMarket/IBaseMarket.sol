// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <0.9.0;

interface IBaseMarket {
    event Paused(address account);
    event Unpaused(address account);

    function setFee(uint16 fee) external;

    function setBeneficiary(address beneficiary) external;

    function claimFee(address[] calldata paymentTokens) external;

    function totalFee(address oNFT) external view returns (uint16);

    function balanceOfRoyalty(address oNFT, address[] calldata paymentTokens)
        external
        view
        returns (uint256[] memory);

    function claimRoyalty(address oNFT, address[] calldata paymentTokens)
        external;

    function setPause(bool v) external;
}
