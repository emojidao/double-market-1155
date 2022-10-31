import { expect } from "chai";
import { ethers } from "hardhat";
const firstTokenId = 1;
const secondTokenId = 2;
describe("DoNFT4907Model", function () {
    let ownerOfMarket, adminOfMarket, beneficiaryOfMarket;
    let ownerOfDoNFT, adminOfDoNFT;
    let owner, approved, operator, other;
    let market;

    let testERC4907;
    let doNFT4907;

    beforeEach(async function () {
        [ownerOfMarket, adminOfMarket, beneficiaryOfMarket, ownerOfDoNFT, adminOfDoNFT, owner, approved, operator, other] = await ethers.getSigners();
        const Market = await ethers.getContractFactory("MarketV2");
        market = await Market.deploy();
        await market.initialize(ownerOfMarket.address, adminOfMarket.address, beneficiaryOfMarket.address);

        const TestERC4907Upgradeable = await ethers.getContractFactory("TestERC4907Upgradeable");
        testERC4907 = await TestERC4907Upgradeable.deploy();

        const DoubleSVGV2 = await ethers.getContractFactory("DoubleSVGV2");
        const double_svg_v2 = await DoubleSVGV2.deploy();

        const DoNFT4907Model = await ethers.getContractFactory('DoNFT4907Model', {
            libraries: {
                "DoubleSVGV2": double_svg_v2.address
            }
        });
        doNFT4907 = await DoNFT4907Model.deploy();
        await doNFT4907.deployed();
        await doNFT4907.initialize("do4907", "do4907", market.address, ownerOfDoNFT.address, adminOfDoNFT.address);

        await testERC4907.connect(owner).setApprovalForAll(doNFT4907.address, true);
        await testERC4907.connect(owner).mint(owner.address, firstTokenId);
        await testERC4907.connect(owner).mint(owner.address, secondTokenId);

    })

    describe('mintVNft', function () {
        let receipt = null;
        beforeEach(async function () {
            await testERC4907.connect(owner).approve(approved.address, firstTokenId);
            await testERC4907.connect(owner).setApprovalForAll(operator.address, true);
        });
        it("mintVNft by owner", async function () {
            receipt = await doNFT4907.connect(owner).mintVNft(testERC4907.address, firstTokenId);
            expect(await doNFT4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });

        it("mintVNft by approved", async function () {
            receipt = await doNFT4907.connect(approved).mintVNft(testERC4907.address, firstTokenId);
            expect(await doNFT4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });
        it("mintVNft by operator", async function () {
            receipt = await doNFT4907.connect(operator).mintVNft(testERC4907.address, secondTokenId);
            expect(await doNFT4907.ownerOf(1)).to.be.equal(owner.address);
        });
        it("mintVNft by other", async function () {
            await expect(doNFT4907.connect(other).mintVNft(testERC4907.address, firstTokenId)).to.be.revertedWith("only approved or owner");
        });

        it("should fail when re-mintVNft", async function () {
            receipt = await doNFT4907.connect(owner).mintVNft(testERC4907.address, firstTokenId);
            expect(await doNFT4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
            await expect(doNFT4907.connect(owner).mintVNft(testERC4907.address, firstTokenId)).to.be.revertedWith("already minted");
        });

    });

    describe('redeem', function () {
        let receipt = null;
        let doNFTId = 1;
        beforeEach(async function () {
            await doNFT4907.connect(owner).mintVNft(testERC4907.address, firstTokenId);
            await doNFT4907.connect(owner).approve(approved.address, firstTokenId);
            await doNFT4907.connect(owner).setApprovalForAll(operator.address, true);
        });
        it("redeem by owner", async function () {
            receipt = await doNFT4907.connect(owner).redeem(doNFTId);
            expect(await testERC4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });

        it("redeem by approved", async function () {
            receipt = await doNFT4907.connect(approved).redeem(doNFTId);
            expect(await testERC4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });
        it("redeem by operator", async function () {
            receipt = await doNFT4907.connect(operator).redeem(doNFTId);
            expect(await testERC4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });
        it("redeem by other", async function () {
            await expect(doNFT4907.connect(other).redeem(firstTokenId)).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
        });

        it("re-mintVNft after redeem ", async function () {
            receipt = await doNFT4907.connect(owner).redeem(doNFTId);
            expect(await testERC4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
            await doNFT4907.connect(owner).mintVNft(testERC4907.address, firstTokenId);
            expect(await doNFT4907.ownerOf(2)).to.be.equal(owner.address);
        });

    });



});

