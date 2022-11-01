import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";


describe("ERC1155Market-5006", function () {
    const ETH_Address = "0x0000000000000000000000000000000000000000";
    const Zero = "0x0000000000000000000000000000000000000000";
    let owner, admin, beneficiary, adminOfNFT, beneficiaryOfNFT, lender, renter;
    let alice, bob, carl;
    let contract5006;
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

        const ERC5006Demo = await ethers.getContractFactory("ERC5006Demo");
        contract5006 = await ERC5006Demo.deploy("", 3);
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
        await config.connect(owner).initConfig(contract5006.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);



        const ERC1155RentalMarket = await ethers.getContractFactory("ERC1155RentalMarket");
        market = await ERC1155RentalMarket.deploy();
        market.initialize(owner.address, admin.address, beneficiary.address, wrapERC1155WithUserRole.address, config.address);

        lendingId = ethers.utils.solidityKeccak256(["address", "uint256", "address"], [contract5006.address, 1, lender.address]);
        rentingId = 1;

        await contract5006.connect(lender).setApprovalForAll(market.address, true);
        await contract5006.mint(lender.address, 1, 100);
    });

    it("mint and create public lend order with ETH", async function () {
        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
        checkLending(
            lendingId,
            lender.address,
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

        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await checkLending(
            lendingId,
            lender.address,
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

    it("cancelLending success by lender", async function () {

        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await market.connect(lender).cancelLending(lendingId);
        await checkLending(
            lendingId,
            lender.address,
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

    it("renter cancelLending fail", async function () {

        await market.createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await expect(market.connect(renter).cancelLending(lendingId)).to.be.revertedWith("not lender");
    });

    it("renter rent5006 with ETH success", async function () {

        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
        await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") });
        await checkLending(
            lendingId,
            lender.address,
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

        await checkRecord(1, 1, 10, market.address, renter.address, expiry);
    });

    it("renter rent5006 with ERC20 success", async function () {
        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(renter.address, ethers.utils.parseEther("10"));
        await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
        await checkLending(
            lendingId,
            lender.address,
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

        await checkRecord(1, 1, 10, market.address, renter.address, expiry);
    });

    it("carl rent5006 with ERC20 fail if FT amount exceeds balance", async function () {
        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(carl.address, ethers.utils.parseEther("9"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await expect(market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
    });

    it("renter carl rent5006 with ERC20 success", async function () {
        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(renter.address, ethers.utils.parseEther("10"));
        await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
        await erc20.mint(carl.address, ethers.utils.parseEther("10"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);
        await checkLending(
            lendingId,
            lender.address,
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

        await checkRecord(1, 1, 10, market.address, renter.address, expiry);

        await checkRecord(2, 1, 10, market.address, carl.address, expiry);
    });

    it("carl rent5006 with ERC20 fail if insufficient remaining amount", async function () {
        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(renter.address, ethers.utils.parseEther("10"));
        await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
        await erc20.mint(carl.address, ethers.utils.parseEther("100"));
        await expect(market.connect(carl).rent5006(lendingId, 91, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("insufficient remaining amount")
    });

    it("carl rent5006 with ERC20 fail if lending is private", async function () {
        await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, bob.address);
        await erc20.mint(carl.address, ethers.utils.parseEther("100"));
        await expect(market.connect(carl).rent5006(lendingId, 91, duration_n, carl.address, erc20.address, pricePerDay)).to.be.revertedWith("invalid renter")
    });

    it("clear rent5006 success", async function () {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestamp = blockBefore.timestamp;
        let _expiry = timestamp + 86400 * 2;
        await market.connect(lender).createLending(contract5006.address, 1, 100, _expiry, pricePerDay, erc20.address, Zero);
        await erc20.mint(carl.address, ethers.utils.parseEther("10"));
        await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
        await market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);
        await hre.network.provider.send("hardhat_mine", ["0x5a1", "0x3c"]);
        await market.clearRenting5006(1);

        await checkLending(
            lendingId,
            lender.address,
            contract5006.address,
            1,
            100,
            0,
            _expiry,
            0,
            pricePerDay,
            erc20.address,
            Zero,
            0
        );

        await checkRenting(1, "0x0000000000000000000000000000000000000000000000000000000000000000", 0);

        await checkRecord(1, 0, 0, Zero, Zero, 0);

        expect(await contract5006.balanceOf(lender.address, 1)).equals(100);
    });

    describe("market fee", function () {
        let receipt = null;
        context('set market beneficiary', function () {
            it("should success if caller is owner", async function () {
                receipt = await market.connect(owner).setBeneficiary(alice.address);
                expect(await market.beneficiary()).equal(alice.address);
            });

            it("should fail if caller is not owner", async function () {
                await expect(market.connect(alice).setBeneficiary(alice.address)).to.be.revertedWith("onlyOwner");
            });
        })

        context('set market fee', function () {
            let fee = 10000;
            let invalidFee = 10001;
            it("should success if caller is owner and fee <=10000", async function () {
                receipt = await market.connect(owner).setFee(fee);
                expect(await market.fee()).equal(fee);
            });
            it("should success if caller is admin and fee <=10000", async function () {
                receipt = await market.connect(admin).setFee(fee);
                expect(await market.fee()).equal(fee);
            });

            it("should fail if market fee > 10000", async function () {
                await expect(market.connect(owner).setFee(invalidFee)).to.be.revertedWith("invalid fee");
            });
        })

        context('total fee', function () {
            it("totalFee = marketFee + royaltyFee", async function () {
                const marketFee = await market.fee();
                const _config = await config.getConfig(contract5006.address);
                expect(await market.totalFee(contract5006.address)).equal(marketFee + _config.fee);
            });
        })

        context('claim market fee', function () {
            it("should success if caller is beneficiary", async function () {
                await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
                await erc20.mint(renter.address, ethers.utils.parseEther("10"));
                await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
                await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);
                await erc20.mint(carl.address, ethers.utils.parseEther("10"));
                await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
                await market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);

                await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
                await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") });

                receipt = await market.connect(beneficiary).claimFee([ETH_Address, erc20.address]);

                let _balance = await market.balanceOfFee([ETH_Address, erc20.address])
                expect(_balance[0]).equal(0);
                expect(_balance[1]).equal(0);
            });

            it("should fail if caller is not beneficiary", async function () {
                await expect(market.connect(alice).claimFee([ETH_Address, erc20.address])).to.be.revertedWith("not beneficiary");
            });
        })

    })

    describe("royalty", function () {
        let receipt = null;
        beforeEach(async function () {
            await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero);
            await erc20.mint(renter.address, ethers.utils.parseEther("10"));
            await erc20.connect(renter).approve(market.address, ethers.utils.parseEther("10"));
            await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, erc20.address, pricePerDay);

            await erc20.mint(carl.address, ethers.utils.parseEther("10"));
            await erc20.connect(carl).approve(market.address, ethers.utils.parseEther("10"));
            await market.connect(carl).rent5006(lendingId, 10, duration_n, carl.address, erc20.address, pricePerDay);

            await market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, ETH_Address, Zero);
            await market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") });
        });
        context('balanceOfRoyalty', function () {
            it("The balance of royalty should be 2.5% of the total transaction amount", async function () {
                let balances = await market.balanceOfRoyalty(contract5006.address, [ETH_Address, erc20.address])
                expect(balances[0]).equal(ethers.utils.parseEther('0.25'))
                expect(balances[1]).equal(ethers.utils.parseEther('0.50'))
            });
        })

        context('claim royalty', function () {
            it("should success if caller is beneficiary Of NFT", async function () {
                const balances_before = await market.balanceOfRoyalty(contract5006.address, [ETH_Address, erc20.address])
                const balance_eth_beneficiary_of_NFT_before = await ethers.provider.getBalance(beneficiaryOfNFT.address)
                const balance_erc20_beneficiary_of_NFT_before = await erc20.balanceOf(beneficiaryOfNFT.address)
                const tx = await market.connect(beneficiaryOfNFT).claimRoyalty(contract5006.address, [ETH_Address, erc20.address]);
                const receipt = await tx.wait()
                const gasUsed = receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice);
                const balances_after = await market.balanceOfRoyalty(contract5006.address, [ETH_Address, erc20.address])
                expect(balances_after[0]).equal(0)
                expect(balances_after[1]).equal(0)
                const balance_eth_beneficiary_of_NFT_after = await ethers.provider.getBalance(beneficiaryOfNFT.address)
                const balance_erc20_beneficiary_of_NFT_after = await erc20.balanceOf(beneficiaryOfNFT.address)

                expect(balance_eth_beneficiary_of_NFT_before.sub(gasUsed).add(balances_before[0])).equal(balance_eth_beneficiary_of_NFT_after)
                expect(balance_erc20_beneficiary_of_NFT_before.add(balances_before[1])).equal(balance_erc20_beneficiary_of_NFT_after)
            });
            it("should fail if caller is not beneficiary Of NFT", async function () {
                await expect(market.connect(alice).claimRoyalty(contract5006.address, [ETH_Address, erc20.address])).to.be.revertedWith("not beneficiary");
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
            await market.connect(owner).setPause(true)
        });
        it("should fail", async function () {
            await expect(market.connect(lender).createLending(contract5006.address, 1, 100, expiry, pricePerDay, erc20.address, Zero)).to.be.revertedWith("is pausing");
            await expect(market.connect(lender).cancelLending(lendingId)).to.be.revertedWith("is pausing");
            await expect(market.connect(renter).rent5006(lendingId, 10, duration_n, renter.address, ETH_Address, pricePerDay, { value: ethers.utils.parseEther("10") })).to.be.revertedWith("is pausing");
            await expect(market.connect(beneficiary).claimFee([ETH_Address, erc20.address])).to.be.revertedWith("is pausing");
            await expect(market.connect(alice).claimRoyalty(contract5006.address, [ETH_Address, erc20.address])).to.be.revertedWith("is pausing");
        });
        it("should succee", async function () {
            await market.connect(owner).setPause(false)
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

    // describe("multicall", function () {

    //     let iface = new ethers.utils.Interface(ABI_MARKET_V2);

    //     it("create lend order", async function () {
    //         let data_valid = iface.encodeFunctionData("mintAndCreateLendOrder", [testERC4907.address, pricePerDay, doNFT4907.address, maxEndTime, first4907Id, ETH_Address, 86400, 0, address0]);
    //         let data_invalid = iface.encodeFunctionData("mintAndCreateLendOrder", [testERC4907.address, pricePerDay, doNFT4907.address, maxEndTime, 100, ETH_Address, 86400, 0, address0]);
    //         await market.connect(lender).multicall([data_valid, data_invalid])
    //         expect(await market.isLendOrderValid(doNFT4907.address, 1)).equal(true);
    //         expect(await market.isLendOrderValid(doNFT4907.address, 2)).equal(false);
    //     });

    // })


});