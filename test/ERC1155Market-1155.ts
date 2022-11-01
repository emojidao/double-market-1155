import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";


describe("Test 1155 Market", function () {
    const ETH_Address = "0x0000000000000000000000000000000000000000";
    const Zero = "0x0000000000000000000000000000000000000000";
    const Uint64Max = "18446744073709551615";
    let owner, admin, beneficiary, royaltyAdminOfNFT, royaltyBeneficiaryOfNFT, lender, renter;
    let alice, bob, carl;
    let contract1155;
    let contract5006;
    let expiry;
    let duration_n = 1;
    let pricePerDay;
    let factory;
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
        let record = await contract5006.userRecordOf(rentingId);
        // console.log(record);
    }

    beforeEach(async function () {
        [owner, admin, beneficiary, royaltyAdminOfNFT, royaltyBeneficiaryOfNFT, lender, renter, alice, bob, carl] = await ethers.getSigners();
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
        const config = await upgrades.deployProxy(RentalConfig, [owner.address], { unsafeAllow: ["delegatecall"] });
        await config.deployed();
        await config.initConfig(contract1155.address, royaltyAdminOfNFT.address, royaltyBeneficiaryOfNFT.address, 2500, 86400, 86400 * 180);

        const ERC1155RentalMarket = await ethers.getContractFactory("ERC1155RentalMarket");
        market = await ERC1155RentalMarket.deploy();
        market.initialize(owner.address, admin.address, beneficiary.address, wrapERC1155WithUserRole.address, config.address);

        await deployWrapERC1155(contract1155.address);

        await contract1155.mint(lender.address, 1, 200);
        await contract1155.connect(lender).setApprovalForAll(market.address, true);

        lendingId = ethers.utils.solidityKeccak256(["address", "uint256", "address"], [contract1155.address, 1, lender.address]);
        rentingId = 1;
    });

    async function deployWrapERC1155(addr) {
        let tx = await market.deployWrapERC1155(addr);
        let receipt = await tx.wait();
        let event = receipt.events[1]
        assert.equal(event.eventSignature, 'DeployWrapERC1155(address,address)')
        contract5006 = await ethers.getContractAt("WrappedInERC5006", event.args[1]);
    }

    it("mint and create public lend order with ETH", async function () {
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
        checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

        market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await market.connect(lender).cancelLending(lendingId);
        await checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

    it("renter cancelLending fail", async function () {

        await market.createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await expect(market.connect(renter).cancelLending(lendingId)).to.be.revertedWith("not lender");
    });

    it("renter rent1155 with ETH success", async function () {

        await market.createLending(contract1155.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
        await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") });
        await checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

        await checkRecord(1, 1, 10, market.address, renter.address, expiry);
    });

    it("renter rent1155 with ERC20 success", async function () {
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(renter.address, ethers.utils.parseEther("10"));
        await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
        await checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

        await checkRecord(1, 1, 10, market.address, renter.address, expiry);
    });

    it("carl rent1155 with ERC20 fail if FT amount exceeds balance", async function () {
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(carl.address, ethers.utils.parseEther("9"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await expect(market.connect(carl).rent1155(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
    });

    it("renter carl rent1155 with ERC20 success", async function () {
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(renter.address, ethers.utils.parseEther("10"));
        await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
        await erc20.mint(carl.address, ethers.utils.parseEther("10"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(carl).rent1155(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);
        await checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

        await checkRecord(1, 1, 10, market.address, renter.address, expiry);

        await checkRecord(2, 1, 10, market.address, carl.address, expiry);
    });

    it("carl rent1155 with ERC20 fail if insufficient remaining amount", async function () {
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(renter.address, ethers.utils.parseEther("10"));
        await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
        await erc20.mint(carl.address, ethers.utils.parseEther("100"));
        await expect(market.connect(carl).rent1155(lendingId, 91, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("insufficient remaining amount")
    });

    it("clear rent1155 success", async function () {
        await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(carl.address, ethers.utils.parseEther("10"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(carl).rent1155(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);
        await hre.network.provider.send("hardhat_mine", ["0x5a1", "0x3c"]);
        await market.clearRenting1155(1);

        await checkLending(
            lendingId,
            lender.address,
            contract1155.address,
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

        expect(await contract5006.balanceOf(alice.address, 1)).equals(0);
        expect(await contract1155.balanceOf(alice.address, 1)).equals(200);

    });

    describe("market fee", function () {
        let receipt = null;
        context('set market beneficiary', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).setMarketBeneficiary(alice.address);
                expect(await market.marketBeneficiary()).equal(alice.address);
            });

            it("should fail if caller is not owner", async function () {
                await expect(market.connect(alice).setMarketBeneficiary(alice.address)).to.be.revertedWith("onlyOwner");
            });
        })

        context('set market fee', function () {
            let fee = 10000;
            let invalidFee = 10001;
            it("should success if caller is owner and fee <=10000", async function () {
                receipt = await market.connect(owner).setMarketFee(fee);
                expect(await market.getMarketFee()).equal(fee);
            });
            it("should success if caller is admin and fee <=10000", async function () {
                receipt = await market.connect(admin).setMarketFee(fee);
                expect(await market.getMarketFee()).equal(fee);
            });

            it("should fail if market fee > 10000", async function () {
                await expect(market.connect(owner).setMarketFee(invalidFee)).to.be.revertedWith("invalid fee");
            });
        })

        context('claim market fee', function () {
            it("should success if caller is beneficiary", async function () {
                await market.connect(lender).createLending(contract1155.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
                await erc20.mint(renter.address, ethers.utils.parseEther("10"));
                await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
                await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
                await erc20.mint(carl.address, ethers.utils.parseEther("10"));
                await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
                await market.connect(carl).rent1155(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);

                await market.createLending(contract1155.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
                await market.connect(renter).rent1155(lendingId, 10, duration_n, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") });

                receipt = await market.connect(beneficiary).claimMarketFee([ETH_Address, erc20.address]);
                expect(await market.marketBalanceOfFee(ETH_Address)).equal(0);
                expect(await market.marketBalanceOfFee(erc20.address)).equal(0);
            });

            it("should fail if caller is not beneficiary", async function () {
                await expect(market.connect(alice).claimMarketFee([ETH_Address, erc20.address])).to.be.revertedWith("not beneficiary");
            });
        })

    })

    describe("royalty", function () {
        let receipt = null;
        context('set royalty admin', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).setRoyaltyAdmin(testERC4907.address, royaltyAdminOfNFT.address);
                await expect(receipt).to.emit(market, "RoyaltyAdminChanged").withArgs(owner.address, testERC4907.address, royaltyAdminOfNFT.address);
                expect(await market.getRoyaltyAdmin(testERC4907.address)).equal(royaltyAdminOfNFT.address);
            });

            it("should success if caller is admin", async function () {
                receipt = await market.connect(admin).setRoyaltyAdmin(testERC4907.address, royaltyAdminOfNFT.address);
                await expect(receipt).to.emit(market, "RoyaltyAdminChanged").withArgs(admin.address, testERC4907.address, royaltyAdminOfNFT.address);
                expect(await market.getRoyaltyAdmin(testERC4907.address)).equal(royaltyAdminOfNFT.address);
            });

            it("should fail if caller is not owner nor admin ", async function () {
                await expect(market.connect(alice).setRoyaltyAdmin(testERC4907.address, royaltyAdminOfNFT.address)).to.be.revertedWith("onlyAdmin");
            });
        })

        context('set royalty beneficiary', function () {
            it("should success if caller is royalty admin", async function () {
                await market.connect(owner).setRoyaltyAdmin(testERC4907.address, royaltyAdminOfNFT.address);
                receipt = await market.connect(royaltyAdminOfNFT).setRoyaltyBeneficiary(testERC4907.address, royaltyBeneficiaryOfNFT.address);
                await expect(receipt).to.emit(market, "RoyaltyBeneficiaryChanged").withArgs(royaltyAdminOfNFT.address, testERC4907.address, royaltyBeneficiaryOfNFT.address);
                expect(await market.getRoyaltyBeneficiary(testERC4907.address)).equal(royaltyBeneficiaryOfNFT.address);
            });
            it("should fail if caller is not royalty admin ", async function () {
                await expect(market.connect(alice).setRoyaltyBeneficiary(testERC4907.address, royaltyBeneficiaryOfNFT.address)).to.be.revertedWith("msg.sender is not royaltyAdmin");
            });
        })

        context('set royalty fee', function () {
            let royaltyFee = 10000;
            let invalidFee = 10001;
            it("should success if caller is royalty admin and fee <=10000", async function () {
                await market.connect(owner).setRoyaltyAdmin(testERC4907.address, lender.address);
                receipt = await market.connect(lender).setRoyaltyFee(testERC4907.address, royaltyFee);
                await expect(receipt).to.emit(market, "RoyaltyFeeChanged").withArgs(lender.address, testERC4907.address, royaltyFee);
                expect(await market.getRoyaltyFee(testERC4907.address)).equal(royaltyFee);
            });
            it("should fail if caller is not royalty admin ", async function () {
                await expect(market.connect(alice).setRoyaltyFee(testERC4907.address, royaltyFee)).to.be.revertedWith("msg.sender is not royaltyAdmin");
            });

            it("should fail if royalty fee > 10000", async function () {
                await market.connect(owner).setRoyaltyAdmin(testERC4907.address, lender.address);
                await expect(market.connect(lender).setRoyaltyFee(testERC4907.address, invalidFee)).to.be.revertedWith("fee exceeds 10pct");
            });
        })

    })


    describe("pause & unpause", function () {
        let receipt = null;
        context('pause unpause', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).setPause(true);
                await expect(receipt).to.emit(market, "Paused").withArgs(market.address);
                expect(await market.isPausing()).equal(true);

                receipt = await market.connect(owner).setPause(false);
                await expect(receipt).to.emit(market, "Unpaused").withArgs(market.address);
                expect(await market.isPausing()).equal(false);
            });

            it("should success if caller is admin", async function () {
                receipt = await market.connect(admin).setPause(true);
                await expect(receipt).to.emit(market, "Paused").withArgs(market.address);
                expect(await market.isPausing()).equal(true);

                receipt = await market.connect(admin).setPause(false);
                await expect(receipt).to.emit(market, "Unpaused").withArgs(market.address);
                expect(await market.isPausing()).equal(false);
            });

            it("should fail if caller is not owner nor admin ", async function () {
                await expect(market.connect(alice).setPause(alice.address)).to.be.revertedWith("onlyAdmin");
            });
        })

    })

    describe("when Market is pause", function () {
        beforeEach(async function () {
            await market.setPause(true)
        });
        it("should fail", async function () {
            await expect(market.connect(lender).mintAndCreateLendOrder(testERC4907.address, pricePerDay, doNFT4907.address, maxEndTime, first4907Id, ETH_Address, 86400, 0, address0)).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).createLendOrder(doNFT4907.address, maxEndTime, 0, 1, ETH_Address, pricePerDay, address0, 86400)).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).cancelLendOrder(doNFT4907.address, 1)).to.be.revertedWith("is pausing");
            await expect(market.connect(renter).fulfillOrderNow(doNFT4907.address, 86400, 1, renter.address, ETH_Address, pricePerDay, { value: pricePerDay })).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).claimMarketFee([testERC4907.address])).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).claimRoyalty(testERC4907.address, [ETH_Address])).to.be.revertedWith("is pausing");
            expect(await market.isLendOrderValid(doNFT4907.address, 1)).to.equal(false);
        });

    })

    describe("ownable", function () {
        let receipt = null;
        context('transfer ownership', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).transferOwnership(alice.address);
                await expect(receipt).to.emit(market, "NewPendingOwner").withArgs(ethers.constants.AddressZero, alice.address);
                expect(await market.pendingOwner()).equal(alice.address);

                await expect(market.connect(admin).acceptOwner()).to.be.revertedWith("onlyPendingOwner");
                receipt = await market.connect(alice).acceptOwner();
                await expect(receipt).to.emit(market, "NewOwner").withArgs(owner.address, alice.address);
            });
            it("should fail if caller is not owner ", async function () {
                await expect(market.connect(admin).transferOwnership(alice.address)).to.be.revertedWith("onlyOwner");
            });
        })

        context('set admin', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).setAdmin(alice.address);
                await expect(receipt).to.emit(market, "NewAdmin").withArgs(admin.address, alice.address);
                expect(await market.admin()).equal(alice.address);
            });
            it("should fail if caller is not owner ", async function () {
                await expect(market.connect(admin).setAdmin(alice.address)).to.be.revertedWith("onlyOwner");
            });
        })
        context('renounce ownership', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).renounceOwnership();
                await expect(receipt).to.emit(market, "NewOwner").withArgs(owner.address, ethers.constants.AddressZero);
                await expect(receipt).to.emit(market, "NewAdmin").withArgs(admin.address, ethers.constants.AddressZero);
                await expect(receipt).to.emit(market, "NewPendingOwner").withArgs(ethers.constants.AddressZero, ethers.constants.AddressZero);
                expect(await market.owner()).equal(ethers.constants.AddressZero);
                expect(await market.admin()).equal(ethers.constants.AddressZero);
                expect(await market.pendingOwner()).equal(ethers.constants.AddressZero);
            });
            it("should fail if caller is not owner ", async function () {
                await expect(market.connect(admin).renounceOwnership()).to.be.revertedWith("onlyOwner");
            });
        })
    })

    describe("multicall", function () {
        const ABI_MARKET_V2 = [
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "lender",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "nftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "nftId",
                        "type": "uint256"
                    }
                ],
                "name": "CancelLendOrder",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "lender",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint40",
                        "name": "maxEndTime",
                        "type": "uint40"
                    },
                    {
                        "indexed": false,
                        "internalType": "enum IMarketV2.OrderType",
                        "name": "orderType",
                        "type": "uint8"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint96",
                        "name": "pricePerDay",
                        "type": "uint96"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "erc4907NftId",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "doNftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint40",
                        "name": "minDuration",
                        "type": "uint40"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "doNftId",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "paymentToken",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "privateOrderRenter",
                        "type": "address"
                    }
                ],
                "name": "CreateLendOrderV2",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "renter",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint40",
                        "name": "startTime",
                        "type": "uint40"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "lender",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint40",
                        "name": "endTime",
                        "type": "uint40"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "erc4907NftId",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "doNftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "doNftId",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "newId",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "paymentToken",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint96",
                        "name": "pricePerDay",
                        "type": "uint96"
                    }
                ],
                "name": "FulfillOrderV2",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "oldAdmin",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "newAdmin",
                        "type": "address"
                    }
                ],
                "name": "NewAdmin",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "oldOwner",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "newOwner",
                        "type": "address"
                    }
                ],
                "name": "NewOwner",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "oldPendingOwner",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "newPendingOwner",
                        "type": "address"
                    }
                ],
                "name": "NewPendingOwner",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "account",
                        "type": "address"
                    }
                ],
                "name": "Paused",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "operator",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "royaltyAdmin",
                        "type": "address"
                    }
                ],
                "name": "RoyaltyAdminChanged",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "operator",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "beneficiary",
                        "type": "address"
                    }
                ],
                "name": "RoyaltyBeneficiaryChanged",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "operator",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint32",
                        "name": "royaltyFee",
                        "type": "uint32"
                    }
                ],
                "name": "RoyaltyFeeChanged",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "account",
                        "type": "address"
                    }
                ],
                "name": "Unpaused",
                "type": "event"
            },
            {
                "inputs": [],
                "name": "acceptOwner",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "admin",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "paymentToken",
                        "type": "address"
                    }
                ],
                "name": "balanceOfRoyalty",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "nftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "nftId",
                        "type": "uint256"
                    }
                ],
                "name": "cancelLendOrder",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address[]",
                        "name": "paymentTokens",
                        "type": "address[]"
                    }
                ],
                "name": "claimMarketFee",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "address[]",
                        "name": "paymentTokens",
                        "type": "address[]"
                    }
                ],
                "name": "claimRoyalty",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "doNftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint40",
                        "name": "maxEndTime",
                        "type": "uint40"
                    },
                    {
                        "internalType": "enum IMarketV2.OrderType",
                        "name": "orderType",
                        "type": "uint8"
                    },
                    {
                        "internalType": "uint256",
                        "name": "doNftId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "address",
                        "name": "paymentToken",
                        "type": "address"
                    },
                    {
                        "internalType": "uint96",
                        "name": "pricePerDay",
                        "type": "uint96"
                    },
                    {
                        "internalType": "address",
                        "name": "privateOrderRenter",
                        "type": "address"
                    },
                    {
                        "internalType": "uint40",
                        "name": "minDuration",
                        "type": "uint40"
                    }
                ],
                "name": "createLendOrder",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "doNftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint40",
                        "name": "duration",
                        "type": "uint40"
                    },
                    {
                        "internalType": "uint256",
                        "name": "doNftId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "paymentToken",
                        "type": "address"
                    },
                    {
                        "internalType": "uint96",
                        "name": "pricePerDay",
                        "type": "uint96"
                    }
                ],
                "name": "fulfillOrderNow",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    }
                ],
                "name": "getBeneficiary",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "nftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "nftId",
                        "type": "uint256"
                    }
                ],
                "name": "getLendOrder",
                "outputs": [
                    {
                        "components": [
                            {
                                "internalType": "address",
                                "name": "lender",
                                "type": "address"
                            },
                            {
                                "internalType": "uint40",
                                "name": "maxEndTime",
                                "type": "uint40"
                            },
                            {
                                "internalType": "uint16",
                                "name": "nonce",
                                "type": "uint16"
                            },
                            {
                                "internalType": "address",
                                "name": "doNftAddress",
                                "type": "address"
                            },
                            {
                                "internalType": "uint40",
                                "name": "minDuration",
                                "type": "uint40"
                            },
                            {
                                "internalType": "enum IMarketV2.OrderType",
                                "name": "orderType",
                                "type": "uint8"
                            },
                            {
                                "internalType": "uint256",
                                "name": "doNftId",
                                "type": "uint256"
                            },
                            {
                                "internalType": "address",
                                "name": "paymentToken",
                                "type": "address"
                            },
                            {
                                "internalType": "address",
                                "name": "privateOrderRenter",
                                "type": "address"
                            },
                            {
                                "internalType": "uint96",
                                "name": "pricePerDay",
                                "type": "uint96"
                            }
                        ],
                        "internalType": "struct IMarketV2.Lending",
                        "name": "",
                        "type": "tuple"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getMarketFee",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    }
                ],
                "name": "getRoyaltyAdmin",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    }
                ],
                "name": "getRoyaltyFee",
                "outputs": [
                    {
                        "internalType": "uint32",
                        "name": "",
                        "type": "uint32"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "owner_",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "admin_",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "marketBeneficiary_",
                        "type": "address"
                    }
                ],
                "name": "initialize",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "doNftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "doNftId",
                        "type": "uint256"
                    }
                ],
                "name": "isLendOrderValid",
                "outputs": [
                    {
                        "internalType": "bool",
                        "name": "",
                        "type": "bool"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "isPausing",
                "outputs": [
                    {
                        "internalType": "bool",
                        "name": "",
                        "type": "bool"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "name": "marketBalanceOfFee",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "marketBeneficiary",
                "outputs": [
                    {
                        "internalType": "address payable",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "maxIndate",
                "outputs": [
                    {
                        "internalType": "uint40",
                        "name": "",
                        "type": "uint40"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint96",
                        "name": "pricePerDay",
                        "type": "uint96"
                    },
                    {
                        "internalType": "address",
                        "name": "doNftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint40",
                        "name": "maxEndTime",
                        "type": "uint40"
                    },
                    {
                        "internalType": "uint256",
                        "name": "erc4907NftId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "address",
                        "name": "paymentToken",
                        "type": "address"
                    },
                    {
                        "internalType": "uint40",
                        "name": "minDuration",
                        "type": "uint40"
                    },
                    {
                        "internalType": "enum IMarketV2.OrderType",
                        "name": "orderType",
                        "type": "uint8"
                    },
                    {
                        "internalType": "address",
                        "name": "privateOrderRenter",
                        "type": "address"
                    }
                ],
                "name": "mintAndCreateLendOrder",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "bytes[]",
                        "name": "data",
                        "type": "bytes[]"
                    }
                ],
                "name": "multicall",
                "outputs": [
                    {
                        "internalType": "bytes[]",
                        "name": "results",
                        "type": "bytes[]"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "owner",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "pendingOwner",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "renounceOwnership",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "newAdmin",
                        "type": "address"
                    }
                ],
                "name": "setAdmin",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "beneficiary",
                        "type": "address"
                    }
                ],
                "name": "setBeneficiary",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address payable",
                        "name": "beneficiary_",
                        "type": "address"
                    }
                ],
                "name": "setMarketBeneficiary",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "fee_",
                        "type": "uint256"
                    }
                ],
                "name": "setMarketFee",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint40",
                        "name": "max_",
                        "type": "uint40"
                    }
                ],
                "name": "setMaxIndate",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "bool",
                        "name": "pause_",
                        "type": "bool"
                    }
                ],
                "name": "setPause",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "royaltyAdmin",
                        "type": "address"
                    }
                ],
                "name": "setRoyaltyAdmin",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "erc4907NftAddress",
                        "type": "address"
                    },
                    {
                        "internalType": "uint32",
                        "name": "royaltyFee",
                        "type": "uint32"
                    }
                ],
                "name": "setRoyaltyFee",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "_pendingOwner",
                        "type": "address"
                    }
                ],
                "name": "transferOwnership",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
        let iface = new ethers.utils.Interface(ABI_MARKET_V2);

        it("create lend order", async function () {
            let data_valid = iface.encodeFunctionData("mintAndCreateLendOrder", [testERC4907.address, pricePerDay, doNFT4907.address, maxEndTime, first4907Id, ETH_Address, 86400, 0, address0]);
            let data_invalid = iface.encodeFunctionData("mintAndCreateLendOrder", [testERC4907.address, pricePerDay, doNFT4907.address, maxEndTime, 100, ETH_Address, 86400, 0, address0]);
            await market.connect(lender).multicall([data_valid, data_invalid])
            expect(await market.isLendOrderValid(doNFT4907.address, 1)).equal(true);
            expect(await market.isLendOrderValid(doNFT4907.address, 2)).equal(false);
        });

    })


});