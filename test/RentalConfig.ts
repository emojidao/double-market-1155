import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { json } from "hardhat/internal/core/params/argumentTypes";

describe("RentalConfig", function () {
    let superAdmin, adminOfNFT, beneficiaryOfNFT, other;
    let contract1155;
    let rentalConfig;
    let receipt = null;

    beforeEach(async function () {
        [superAdmin, adminOfNFT, beneficiaryOfNFT, other] = await ethers.getSigners();
        const RentalConfig = await ethers.getContractFactory("RentalConfig");
        rentalConfig = await upgrades.deployProxy(RentalConfig, [superAdmin.address], { unsafeAllow: ["delegatecall"] });
        await rentalConfig.deployed();

        const Test1155 = await ethers.getContractFactory("Test1155");
        contract1155 = await Test1155.deploy();

    });
    describe("", function () {
        context('init config', function () {
            it("should success if caller is super admin", async function () {
                receipt = await rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
                await expect(receipt).to.emit(rentalConfig, "UpdateAdmin").withArgs(contract1155.address, adminOfNFT.address);
                await expect(receipt).to.emit(rentalConfig, "UpdateConfig").withArgs(contract1155.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
                let config = await rentalConfig.getConfig(contract1155.address);
                expect(config.admin).equal(adminOfNFT.address);
                expect(config.beneficiary).equal(beneficiaryOfNFT.address);
                expect(config.fee).equal(2500);
                expect(config.cycle).equal(86400);
                expect(config.maxLendingDuration).equal(86400 * 180);
            });

            it("should fail if caller is not super admin ", async function () {
                await expect(rentalConfig.connect(other).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180)).to.be.revertedWith("only super admin");
            });

            it("should fail if re-init", async function () {
                await rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
                await expect(rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180)).to.be.revertedWith("inited alerady");
            });

            it("should fail if fee > 10000 ", async function () {
                await expect(rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 10001, 86400, 86400 * 180)).to.be.revertedWith("fee exceeds 10pct");
            });

            it("should fail if Cycle > maxLendingDuration ", async function () {
                await expect(rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400 * 2, 86400)).to.be.revertedWith("Cycle time cannot be greater than maxLendingDuration");
            });
        })

        context('set config', function () {
            beforeEach(async function () {
                await rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
            });
            it("should success if caller is super admin", async function () {
                receipt = await rentalConfig.connect(superAdmin).setConfig(contract1155.address, other.address, 2500, 86400, 86400 * 180);
                await expect(receipt).to.emit(rentalConfig, "UpdateConfig").withArgs(contract1155.address, other.address, 2500, 86400, 86400 * 180);
                let config = await rentalConfig.getConfig(contract1155.address);
                expect(config.admin).equal(adminOfNFT.address);
                expect(config.beneficiary).equal(other.address);
                expect(config.fee).equal(2500);
                expect(config.cycle).equal(86400);
                expect(config.maxLendingDuration).equal(86400 * 180);
            });

            it("should fail if caller is not super admin nor admin of NFT ", async function () {
                await expect(rentalConfig.connect(other).setConfig(contract1155.address, other.address, 2500, 86400, 86400 * 180)).to.be.revertedWith("only admin");
            });

            it("should fail if fee > 10000 ", async function () {
                await expect(rentalConfig.connect(superAdmin).setConfig(contract1155.address, beneficiaryOfNFT.address, 10001, 86400, 86400 * 180)).to.be.revertedWith("fee exceeds 10pct");
            });

            it("should fail if Cycle > maxLendingDuration ", async function () {
                await expect(rentalConfig.connect(superAdmin).setConfig(contract1155.address, beneficiaryOfNFT.address, 2500, 86400 * 2, 86400)).to.be.revertedWith("Cycle time cannot be greater than maxLendingDuration");
            });
        })

        context('reset Admin', function () {
            beforeEach(async function () {
                await rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
            });
            it("should success if caller is super admin", async function () {
                receipt = await rentalConfig.connect(superAdmin).resetAdmin(contract1155.address, other.address);
                await expect(receipt).to.emit(rentalConfig, "UpdateAdmin").withArgs(contract1155.address, other.address);
                let config = await rentalConfig.getConfig(contract1155.address);
                expect(config.admin).equal(other.address);
                expect(config.beneficiary).equal(beneficiaryOfNFT.address);
                expect(config.fee).equal(2500);
                expect(config.cycle).equal(86400);
                expect(config.maxLendingDuration).equal(86400 * 180);
            });

            it("should fail if caller is not super admin ", async function () {
                await expect(rentalConfig.connect(other).resetAdmin(contract1155.address, other.address)).to.be.revertedWith("only super admin");
            });

        })

        context('set Temp Admin', function () {
            beforeEach(async function () {
                await rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
            });
            it("should success if caller is super admin", async function () {
                receipt = await rentalConfig.connect(superAdmin).setTempAdmin(contract1155.address, other.address);
                let config = await rentalConfig.getConfig(contract1155.address);
                expect(config.tempAdmin).equal(other.address);
            });
            it("should success if caller is admin of NFT", async function () {
                receipt = await rentalConfig.connect(superAdmin).setTempAdmin(contract1155.address, other.address);
                let config = await rentalConfig.getConfig(contract1155.address);
                expect(config.tempAdmin).equal(other.address);
            });

            it("should fail if caller is not admin ", async function () {
                await expect(rentalConfig.connect(other).setTempAdmin(contract1155.address, other.address)).to.be.revertedWith("only admin");
            });
        })

        context('claim admin', function () {
            beforeEach(async function () {
                await rentalConfig.connect(superAdmin).initConfig(contract1155.address, adminOfNFT.address, beneficiaryOfNFT.address, 2500, 86400, 86400 * 180);
                await rentalConfig.connect(superAdmin).setTempAdmin(contract1155.address, other.address);
            });
            it("should success if caller is temp admin", async function () {
                receipt = await rentalConfig.connect(other).claimAdmin(contract1155.address);
                await expect(receipt).to.emit(rentalConfig, "UpdateAdmin").withArgs(contract1155.address, other.address);
                let config = await rentalConfig.getConfig(contract1155.address);
                expect(config.admin).equal(other.address);
            });

            it("should fail if caller is not temp admin ", async function () {
                await expect(rentalConfig.connect(superAdmin).claimAdmin(contract1155.address)).to.be.revertedWith("only temp admin");
            });
        })

    })

});