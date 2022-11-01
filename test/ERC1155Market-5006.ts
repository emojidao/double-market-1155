import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";


describe("Test 1155 Market", function () {
    const ETH_Address = "0x0000000000000000000000000000000000000000";
    const Zero = "0x0000000000000000000000000000000000000000";
    const Uint64Max = "18446744073709551615";
    let alice, bob, carl;
    let contract5006;
    let expiry;
    let duration_n = 1;
    let pricePerDay;
    let market;
    let erc20;
    let lendingId;
    let rentingId;

    async function checkRecord(rid, tokenId, amount, owner, user, expiry_) {
        expiry_ = BigNumber.from(expiry_ + "")
        let record = await contract5006.userRecordOf(rid);
        expect(record[0]).equals(tokenId, "tokenId");
        expect(record[1]).equals(owner, "owner");
        expect(record[2]).equals(amount, "amount");
        expect(record[3]).equals(user, "user");
        // expect(record[4]).equals(expiry_, "expiry_");
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
        let order = await market.rentingOf(rentingId);
        expect(order[0]).equals(orderId, "lendingId");
        expect(order[1]).equals(recordId, "recordId");
    }

    beforeEach(async function () {
        [alice, bob, carl] = await ethers.getSigners();
        // console.log("alice eth: ", await alice.getBalance());
        // console.log("bob eth: ", await bob.getBalance());
        // console.log("carl eth: ", await carl.getBalance());

        const ERC5006Demo = await ethers.getContractFactory("ERC5006Demo");
        contract5006 = await ERC5006Demo.deploy("", 3);

        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestamp = blockBefore.timestamp;
        expiry = timestamp + 864000;
        pricePerDay = ethers.utils.parseEther("1");
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        erc20 = await TestERC20.deploy("T", "T", 18);
        // erc20.mint(alice.address, ethers.utils.parseEther("100"));
        // erc20.mint(bob.address, ethers.utils.parseEther("100"));

        const WrappedInERC5006 = await ethers.getContractFactory("WrappedInERC5006");
        let wrapERC1155WithUserRole = await WrappedInERC5006.deploy();

        const RentalConfig = await ethers.getContractFactory("RentalConfig");
        const config = await upgrades.deployProxy(RentalConfig, [alice.address], { unsafeAllow: ["delegatecall"] });
        await config.deployed();
        await config.initConfig(contract5006.address, alice.address, alice.address, 2500, 86400, 86400 * 180);



        const ERC1155RentalMarket = await ethers.getContractFactory("ERC1155RentalMarket");
        market = await ERC1155RentalMarket.deploy();
        market.initialize(alice.address, bob.address, alice.address, wrapERC1155WithUserRole.address, config.address);

        lendingId = ethers.utils.solidityKeccak256(["address", "uint256", "address"], [contract5006.address, 1, alice.address]);
        rentingId = 1;
    });

    it("mint and create public lend order with ETH", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);

        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
        checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            0,
            expiry,
            0,
            pricePerDay,
            ETH_Address,
            Zero,
            0
        );

    });

    it("mint and create public lend order with ERC20", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);

        market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            0,
            expiry,
            0,
            pricePerDay,
            erc20.address,
            Zero,
            0
        );

    });

    it("alice cancelLending success", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);

        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await market.cancelLending(lendingId);
        await checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            0,
            0,
            0,
            pricePerDay,
            erc20.address,
            Zero,
            0
        );
    });

    it("bob cancelLending fail", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);

        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await expect(market.connect(bob).cancelLending(lendingId)).to.be.revertedWith("not lender");
    });

    it("bob rent with ETH success", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);

        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
        await market.connect(bob).rent5006(lendingId, 10, duration_n, bob.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") });
        await checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            10,
            expiry,
            0,
            pricePerDay,
            ETH_Address,
            Zero,
            0
        );

        await checkRenting(1, lendingId, 1);

        await checkRecord(1, 1, 10, market.address, bob.address, expiry);
    });

    it("bob rent with ERC20 success 1", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);
        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(bob.address, ethers.utils.parseEther("10"));
        await erc20.connect(bob).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(bob).rent5006(lendingId, 10, duration_n, bob.address, erc20.address, pricePerDay);
        expect(await erc20.balanceOf(bob.address)).equals(ethers.utils.parseEther("0"));
        await checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            10,
            expiry,
            0,
            pricePerDay,
            erc20.address,
            Zero,
            0
        );

        await checkRenting(1, lendingId, 1);

        await checkRecord(1, 1, 10, market.address, bob.address, expiry);
    });

    it("bob rent with ERC20 fail : Uint64Max", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);
        await expect(market.createLending(contract5006.address, 1, 100, Uint64Max, pricePerDay, erc20.address, Zero)).to.be.revertedWith("invalid expiry")
    });

    it("carl rent with ERC20 fail 1", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);
        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(carl.address, ethers.utils.parseEther("9"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await expect(market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
    });

    it("bob carl rent with ERC20 success", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);
        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(bob.address, ethers.utils.parseEther("10"));
        await erc20.connect(bob).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(bob).rent5006(lendingId, 10, duration_n, bob.address, erc20.address, pricePerDay);
        await erc20.mint(carl.address, ethers.utils.parseEther("10"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);
        await checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            20,
            expiry,
            0,
            pricePerDay,
            erc20.address,
            Zero,
            0
        );

        await checkRenting(1, lendingId, 1);

        // await checkRenting(2, lendingId, 2);

        await checkRecord(1, 1, 10, market.address, bob.address, expiry);

        await checkRecord(2, 1, 10, market.address, carl.address, expiry);
    });

    it("carl rent with ERC20 fail 2", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);
        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(bob.address, ethers.utils.parseEther("10"));
        await erc20.connect(bob).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(bob).rent5006(lendingId, 10, duration_n, bob.address, erc20.address, pricePerDay);
        await erc20.mint(carl.address, ethers.utils.parseEther("100"));
        await expect(market.connect(carl).rent5006(lendingId, 91, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("insufficient remaining amount")
    });

    it("clear rent success", async function () {
        await contract5006.setApprovalForAll(market.address, true);
        await contract5006.mint(alice.address, 1, 100);
        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);

        await erc20.mint(carl.address, ethers.utils.parseEther("10"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);
        await hre.network.provider.send("hardhat_mine", ["0x5a00", "0x3c"]);
        await market.clearRenting5006(rentingId);

        await checkLending(
            lendingId,
            alice.address,
            contract5006.address,
            1,
            100,
            0,
            expiry,
            0,
            pricePerDay,
            erc20.address,
            Zero,
            0
        );

        await checkRenting(1, "0x0000000000000000000000000000000000000000000000000000000000000000", 0);

        await checkRecord(1, 0, 0, Zero, Zero, 0);

    });


});