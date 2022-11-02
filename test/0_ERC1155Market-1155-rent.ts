import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";


describe("ERC1155Market-1155-rent", function () {
    const ETH_Address = "0x0000000000000000000000000000000000000000";
    const Zero = "0x0000000000000000000000000000000000000000";
    let owner, admin, beneficiary, adminOfNFT, beneficiaryOfNFT, lender, renter;
    let alice, bob, carl;
    let contract1155;
    let wrap5006;
    let expiry;
    let duration_n = 1;
    let pricePerDay;
    let market;
    let config;
    let erc20;
    let lendingId;
    let rentingId;

    async function checkRecord(rid, tokenId, amount, owner, user, expiry_) {
        expiry_ = BigNumber.from(expiry_ + "")
        if (tokenId == 0) {
            await expect(market.recordOf(rid)).to.be.revertedWith("Nonexistent Record");
        } else {
            let record = await market.recordOf(rid);
            expect(record[0]).equals(tokenId, "tokenId");
            expect(record[1]).equals(owner, "owner");
            expect(record[2]).equals(amount, "amount");
            expect(record[3]).equals(user, "user");
        }
    }

    async function checkLending(orderId, lender, nftAddress, nftId, amount, frozen, expiry_, minDuration, pricePerDay, paymentToken, renter, orderType) {
        expiry_ = BigNumber.from(expiry_ + "")
        let order = await market.lendingOf(orderId);
        expect(order[0]).equals(nftId, "nftId");
        expect(order[1]).equals(nftAddress, "nftAddress");
        expect(order[2]).equals(amount, "amount");
        expect(order[3]).equals(lender, "lender");
        expect(order[4]).equals(frozen, "frozen");
        expect(order[5]).equals(renter, "renter");
        expect(order[6]).equals(expiry_, "expiry_");
        expect(order[7]).equals(paymentToken, "paymentToken");
        expect(order[8]).equals(pricePerDay, "pricePerDay");
    }

    async function checkRenting(rentingId_, orderId, recordId) {
        let order = await market.rentingOf(rentingId_);
        expect(order[0]).equals(orderId, "lendingId");
        expect(order[1]).equals(recordId, "recordId");
    }

    beforeEach(async function () {
        [owner, admin, beneficiary, adminOfNFT, beneficiaryOfNFT, lender, renter, alice, bob, carl] = await ethers.getSigners();
        const Test1155 = await ethers.getContractFactory("Test1155");
        contract1155 = await Test1155.deploy();

        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestamp = blockBefore.timestamp;
        expiry = timestamp + 864000;

        pricePerDay = ethers.utils.parseEther("1");

        const TestERC20 = await ethers.getContractFactory("TestERC20");
        erc20 = await TestERC20.deploy("T", "T", 18);
        erc20.mint(alice.address, ethers.utils.parseEther("10000"));
        erc20.mint(renter.address, ethers.utils.parseEther("10000"));

        const WrappedInERC5006 = await ethers.getContractFactory("WrappedInERC5006");
        let wrapERC1155WithUserRole = await WrappedInERC5006.deploy();

        const RentalConfig = await ethers.getContractFactory("RentalConfig");
        config = await upgrades.deployProxy(RentalConfig, [owner.address], { unsafeAllow: ["delegatecall"] });
        await config.deployed();
        await config.initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);

        const ERC1155RentalMarket = await ethers.getContractFactory("ERC1155RentalMarket");
        market = await ERC1155RentalMarket.deploy();
        market.initialize(owner.address, admin.address, beneficiary.address, wrapERC1155WithUserRole.address, config.address);

        await deployWrapERC1155(contract1155.address);

        await contract1155.mint(lender.address, 1, 100);
        await contract1155.connect(lender).setApprovalForAll(market.address, true);

        lendingId = ethers.utils.solidityKeccak256(["address", "uint256", "address"], [contract1155.address, 1, lender.address]);
        rentingId = 1;
    });

    async function deployWrapERC1155(addr) {
        let tx = await market.deployWrapERC1155(addr);
        let receipt = await tx.wait();
        let event = receipt.events[1]
        assert.equal(event.eventSignature, 'DeployWrapERC1155(address,address)')
        wrap5006 = await ethers.getContractAt("WrappedInERC5006", event.args[1]);

        expect(await market.wNFTOf(contract1155.address)).equal(wrap5006.address)
    }



    it("renter rent1155 with ETH success", async function () {
        const royaltyFee = 2500;
        const cycle = 86400;
        const maxLendingDuration = 86400 * 180;
        const _pricePerDay = ethers.utils.parseEther('0.00001');
        const cycleAmount = 1;
        const amount = 1;
        let totalPrice = _pricePerDay.mul(BigNumber.from(cycle * cycleAmount * amount)).div(BigNumber.from(86400))
        await config.setConfig(contract1155.address, admin.address, royaltyFee, cycle, maxLendingDuration);
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, _pricePerDay, ETH_Address, Zero);
        await market.connect(renter).rent1155(lendingId, amount, cycleAmount, renter.address, ETH_Address, _pricePerDay, { value: totalPrice });
        await checkRenting(1, lendingId, 1);
        await checkRecord(1, 1, amount, market.address, renter.address, expiry);
    });

    it("renter rent1155 with ETH success", async function () {
        const royaltyFee = 2500;
        const cycle = 3600;
        const maxLendingDuration = 86400 * 180;
        const _pricePerDay = ethers.utils.parseEther('0.00001');
        const cycleAmount = 3;
        const amount = 1;
        let totalPrice = _pricePerDay.mul(BigNumber.from(cycle * cycleAmount * amount)).div(BigNumber.from(86400))
        await config.setConfig(contract1155.address, admin.address, royaltyFee, cycle, maxLendingDuration);
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, _pricePerDay, ETH_Address, Zero);
        await market.connect(renter).rent1155(lendingId, amount, cycleAmount, renter.address, ETH_Address, _pricePerDay, { value: totalPrice });
        await checkRenting(1, lendingId, 1);
        await checkRecord(1, 1, amount, market.address, renter.address, expiry);
    });

    it("renter rent1155 with ETH success", async function () {
        const royaltyFee = 2500;
        const cycle = 3600 * 3;
        const maxLendingDuration = 86400 * 180;
        const _pricePerDay = ethers.utils.parseEther('0.00001');
        const cycleAmount = 3;
        const amount = 1;
        let totalPrice = _pricePerDay.mul(BigNumber.from(cycle * cycleAmount * amount)).div(BigNumber.from(86400))
        await config.setConfig(contract1155.address, admin.address, royaltyFee, cycle, maxLendingDuration);
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, _pricePerDay, ETH_Address, Zero);
        await market.connect(renter).rent1155(lendingId, amount, cycleAmount, renter.address, ETH_Address, _pricePerDay, { value: totalPrice });
        await checkRenting(1, lendingId, 1);
        await checkRecord(1, 1, amount, market.address, renter.address, expiry);
    });
    it("renter rent1155 with ETH success", async function () {
        const royaltyFee = 2500;
        const cycle = 86400 * 3;
        const maxLendingDuration = 86400 * 180;
        const _pricePerDay = ethers.utils.parseEther('0');
        const cycleAmount = 3;
        const amount = 1;
        let totalPrice = _pricePerDay.mul(BigNumber.from(cycle * cycleAmount * amount)).div(BigNumber.from(86400))
        await config.setConfig(contract1155.address, admin.address, royaltyFee, cycle, maxLendingDuration);
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, _pricePerDay, ETH_Address, Zero);
        await market.connect(renter).rent1155(lendingId, amount, cycleAmount, renter.address, ETH_Address, _pricePerDay, { value: totalPrice });
        await checkRenting(1, lendingId, 1);
        await checkRecord(1, 1, amount, market.address, renter.address, expiry);
    });

    // it("renter rent1155 with ERC20 success", async function () {
    //     await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
    //     await erc20.mint(renter.address, ethers.utils.parseEther("10"));
    //     await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
    //     await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
    //     await checkRenting(1, lendingId, 1);
    //     await checkRecord(1, 1, 10, market.address, renter.address, expiry);
    // });

});