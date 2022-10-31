import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

describe("Test Market Wrap", function () {

    const ETH_Address = "0x0000000000000000000000000000000000000000";
    const address0 = '0x0000000000000000000000000000000000000000';
    let owner, admin, beneficiary, alice, royaltyAdminOfNFT, royaltyBeneficiaryOfNFT, lender, renter;
    let market;
    let testERC721;
    let w4907;
    let doNFTWrap;
    let maxEndTime;
    let firstTokenId = 1;
    let secondTokenId = 2;
    let pricePerDay = ethers.utils.parseEther("1");
    let erc20;


    beforeEach(async function () {

        [owner, admin, beneficiary, alice, royaltyAdminOfNFT, royaltyBeneficiaryOfNFT, lender, renter] = await ethers.getSigners();

        const TestERC20 = await ethers.getContractFactory("TestERC20");
        erc20 = await TestERC20.deploy("T", "T", 18);

        const Market = await ethers.getContractFactory("MarketV2");
        market = await Market.deploy();
        await market.initialize(owner.address, admin.address, beneficiary.address);

        const TestERC721 = await ethers.getContractFactory("TestERC721");
        testERC721 = await TestERC721.deploy();
        const WrappedInERC4907Upgradeable = await ethers.getContractFactory("WrappedInERC4907Upgradeable");
        w4907 = await WrappedInERC4907Upgradeable.deploy();
        w4907.initialize("WrappedInERC4907Upgradeable", "w4907", testERC721.address);

        const DoubleSVGV2 = await ethers.getContractFactory("DoubleSVGV2");
        const double_svg_v2 = await DoubleSVGV2.deploy();

        const DoNFTWrapModel = await ethers.getContractFactory('DoNFTWrapModel', {
            libraries: {
                "DoubleSVGV2": double_svg_v2.address
            }
        });
        doNFTWrap = await DoNFTWrapModel.deploy();
        await doNFTWrap.deployed();
        await doNFTWrap.initialize("doWrap", "doWrap", market.address, owner.address, admin.address);

        await testERC721.connect(lender).setApprovalForAll(doNFTWrap.address, true);
        await testERC721.mint(lender.address, firstTokenId);
        await testERC721.mint(lender.address, secondTokenId);
        await testERC721.connect(lender).setApprovalForAll(w4907.address, true);
        maxEndTime = Math.floor(new Date().getTime() / 1000 + 86400 * 7);

    });


    describe("when Market2 is not pause", function () {
        it("mint and create lend order with ETH", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            expect(await market.isLendOrderValid(doNFTWrap.address, 1)).equal(true);
            let lendOrder = await market.getLendOrder(doNFTWrap.address, 1)
            expect(lendOrder.lender).equal(lender.address);
            expect(lendOrder.maxEndTime).equal(maxEndTime);
            expect(lendOrder.minDuration).equal(86400);
            expect(lendOrder.orderType).equal(0);
            expect(lendOrder.paymentToken).equal(ETH_Address);
            expect(lendOrder.privateOrderRenter).equal(address0);
            expect(lendOrder.pricePerDay).equal(pricePerDay);
        });

        it("mint and create lend order with ETH limit indate", async function () {
            await market.setMaxIndate(86400 * 6)
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            expect(await market.isLendOrderValid(doNFTWrap.address, 1)).equal(true);
            let lendOrder = await market.getLendOrder(doNFTWrap.address, 1)
            expect(lendOrder.lender).equal(lender.address);
            expect(lendOrder.maxEndTime).lt(maxEndTime);
            expect(lendOrder.minDuration).equal(86400);
            expect(lendOrder.orderType).equal(0);
            expect(lendOrder.paymentToken).equal(ETH_Address);
            expect(lendOrder.privateOrderRenter).equal(address0);
            expect(lendOrder.pricePerDay).equal(pricePerDay);

        });



        it("mint and create lend order with ETH fail", async function () {
            await expect(market.connect(renter).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0)).to.be.revertedWith("only owner");
        });

        it("create lend order with ETH", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            await market.connect(lender).createLendOrder(doNFTWrap.address, maxEndTime, 0, 1, ETH_Address, pricePerDay, address0, 86400);
            expect(await market.isLendOrderValid(doNFTWrap.address, 1)).to.equal(true);
        });
        it("create lend order with ETH fail", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            await expect(market.connect(renter).createLendOrder(doNFTWrap.address, maxEndTime, 0, 1, ETH_Address, pricePerDay, address0, 86400)).to.be.revertedWith("only owner");
        });

        it("cancelLendOrder success", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            await market.connect(lender).cancelLendOrder(doNFTWrap.address, 1);
            expect(await market.isLendOrderValid(doNFTWrap.address, 1)).to.equal(false);
        });

        it("cancelLendOrder fail", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            await expect(market.connect(renter).cancelLendOrder(doNFTWrap.address, 1)).to.be.revertedWith("only owner");
        });

        it("fulfillOrderNow with ETH success", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            await market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, ETH_Address, pricePerDay, { value: pricePerDay });
            expect(await doNFTWrap.ownerOf(2)).equal(renter.address, "ownerOf 2");
            expect(await w4907.userOf(firstTokenId)).equal(renter.address, "userOf");

            await market.connect(renter).createLendOrder(doNFTWrap.address, maxEndTime, 0, 2, ETH_Address, pricePerDay, address0, 86400);
            await market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400 * 2, 2, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther('2') });

        });
        it("fulfillOrderNow with ETH fail", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0);
            await expect(market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("0.9") })).to.be.revertedWith("payment is not enough");
        });

        it("fulfillOrderNow with erc20 success", async function () {
            await market.connect(owner).setRoyaltyAdmin(w4907.address, renter.address);
            await market.connect(renter).setRoyaltyBeneficiary(w4907.address, renter.address)
            await market.connect(renter).setRoyaltyFee(w4907.address, 2500)

            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, erc20.address, 86400, 0, address0);
            await erc20.connect(renter).approve(market.address, pricePerDay);
            erc20.mint(renter.address, pricePerDay);
            await market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, erc20.address, pricePerDay);
            expect(await erc20.balanceOf(renter.address)).equal(0);
            expect(await doNFTWrap.ownerOf(2)).equal(renter.address, "ownerOf 2");
            expect(await w4907.userOf(firstTokenId)).equal(renter.address, "userOf");
            expect(await market.balanceOfRoyalty(w4907.address, erc20.address)).equal(BigNumber.from("25000000000000000"), "balanceOfRoyalty");
            await market.connect(renter).claimRoyalty(w4907.address, [erc20.address])
            expect(await market.balanceOfRoyalty(w4907.address, erc20.address)).equal(0, "after claim");
        });

        it("private fulfillOrderNow with ETH success", async function () {
            await market.connect(owner).setRoyaltyAdmin(w4907.address, renter.address);
            await market.connect(renter).setRoyaltyBeneficiary(w4907.address, renter.address)
            await market.connect(renter).setRoyaltyFee(w4907.address, 2500)

            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 1, renter.address);
            await market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, ETH_Address, pricePerDay, { value: pricePerDay });
            expect(await doNFTWrap.ownerOf(2)).equal(renter.address, "ownerOf 2");
            expect(await w4907.userOf(firstTokenId)).equal(renter.address, "userOf");
            expect(await market.balanceOfRoyalty(w4907.address, ETH_Address)).equal(BigNumber.from("25000000000000000"), "balanceOfRoyalty");
            await market.connect(renter).claimRoyalty(w4907.address, [ETH_Address])
            expect(await market.balanceOfRoyalty(w4907.address, ETH_Address)).equal(0, "after claim");
        });
        it("private fulfillOrderNow with ETH fail", async function () {
            await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 1, renter.address);
            await expect(market.fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, ETH_Address, pricePerDay, { value: pricePerDay })).to.be.revertedWith("invalid renter");
        });

    })

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
                await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, erc20.address, 86400, 0, address0);
                await erc20.connect(renter).approve(market.address, pricePerDay);
                erc20.mint(renter.address, pricePerDay);
                await market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, erc20.address, pricePerDay);

                await market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, secondTokenId, ETH_Address, 86400, 0, address0);
                await market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 3, renter.address, ETH_Address, pricePerDay, { value: pricePerDay });

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
                receipt = await market.connect(owner).setRoyaltyAdmin(w4907.address, royaltyAdminOfNFT.address);
                await expect(receipt).to.emit(market, "RoyaltyAdminChanged").withArgs(owner.address, w4907.address, royaltyAdminOfNFT.address);
                expect(await market.getRoyaltyAdmin(w4907.address)).equal(royaltyAdminOfNFT.address);
            });

            it("should success if caller is admin", async function () {
                receipt = await market.connect(admin).setRoyaltyAdmin(w4907.address, royaltyAdminOfNFT.address);
                await expect(receipt).to.emit(market, "RoyaltyAdminChanged").withArgs(admin.address, w4907.address, royaltyAdminOfNFT.address);
                expect(await market.getRoyaltyAdmin(w4907.address)).equal(royaltyAdminOfNFT.address);
            });

            it("should fail if caller is not owner nor admin ", async function () {
                await expect(market.connect(alice).setRoyaltyAdmin(w4907.address, royaltyAdminOfNFT.address)).to.be.revertedWith("onlyAdmin");
            });
        })

        context('set royalty beneficiary', function () {
            it("should success if caller is royalty admin", async function () {
                await market.connect(owner).setRoyaltyAdmin(w4907.address, royaltyAdminOfNFT.address);
                receipt = await market.connect(royaltyAdminOfNFT).setRoyaltyBeneficiary(w4907.address, royaltyBeneficiaryOfNFT.address);
                await expect(receipt).to.emit(market, "RoyaltyBeneficiaryChanged").withArgs(royaltyAdminOfNFT.address, w4907.address, royaltyBeneficiaryOfNFT.address);
                expect(await market.getRoyaltyBeneficiary(w4907.address)).equal(royaltyBeneficiaryOfNFT.address);
            });
            it("should fail if caller is not royalty admin ", async function () {
                await expect(market.connect(alice).setRoyaltyBeneficiary(w4907.address, royaltyBeneficiaryOfNFT.address)).to.be.revertedWith("msg.sender is not royaltyAdmin");
            });
        })

        context('set royalty fee', function () {
            let royaltyFee = 10000;
            let invalidFee = 10001;
            it("should success if caller is royalty admin and fee <=10000", async function () {
                await market.connect(owner).setRoyaltyAdmin(w4907.address, lender.address);
                receipt = await market.connect(lender).setRoyaltyFee(w4907.address, royaltyFee);
                await expect(receipt).to.emit(market, "RoyaltyFeeChanged").withArgs(lender.address, w4907.address, royaltyFee);
                expect(await market.getRoyaltyFee(w4907.address)).equal(royaltyFee);
            });
            it("should fail if caller is not royalty admin ", async function () {
                await expect(market.connect(alice).setRoyaltyFee(w4907.address, royaltyFee)).to.be.revertedWith("msg.sender is not royaltyAdmin");
            });

            it("should fail if royalty fee > 10000", async function () {
                await market.connect(owner).setRoyaltyAdmin(w4907.address, lender.address);
                await expect(market.connect(lender).setRoyaltyFee(w4907.address, invalidFee)).to.be.revertedWith("fee exceeds 10pct");
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

    describe("when Market2 is pause", function () {
        beforeEach(async function () {
            await market.setPause(true)
        });
        it("should fail", async function () {
            await expect(market.connect(lender).mintAndCreateLendOrder(w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0)).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).createLendOrder(doNFTWrap.address, maxEndTime, 0, 1, ETH_Address, pricePerDay, address0, 86400)).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).cancelLendOrder(doNFTWrap.address, 1)).to.be.revertedWith("is pausing");
            await expect(market.connect(renter).fulfillOrderNow(doNFTWrap.address, 86400, 1, renter.address, ETH_Address, pricePerDay, { value: pricePerDay })).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).claimMarketFee([w4907.address])).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).claimRoyalty(w4907.address, [ETH_Address])).to.be.revertedWith("is pausing");
            expect(await market.isLendOrderValid(doNFTWrap.address, 1)).to.equal(false);
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
            let data_valid = iface.encodeFunctionData("mintAndCreateLendOrder", [w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, firstTokenId, ETH_Address, 86400, 0, address0]);
            let data_invalid = iface.encodeFunctionData("mintAndCreateLendOrder", [w4907.address, pricePerDay, doNFTWrap.address, maxEndTime, 100, ETH_Address, 86400, 0, address0]);
            await market.connect(lender).multicall([data_valid, data_invalid])
            expect(await market.isLendOrderValid(doNFTWrap.address, 1)).equal(true);
            expect(await market.isLendOrderValid(doNFTWrap.address, 2)).equal(false);
        });

    })


})