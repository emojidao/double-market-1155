import { expect } from "chai";
import { ethers } from "hardhat";
const firstTokenId = 1;
const secondTokenId = 2;
describe("DoNFTWrapModel", function () {
    let ownerOfMarket, adminOfMarket, beneficiaryOfMarket;
    let ownerOfDoNFT, adminOfDoNFT;
    let owner, approved, operator, other;
    let market;

    let testERC721;
    let w4907;
    let doNFTWrap;

    beforeEach(async function () {
        [ownerOfMarket, adminOfMarket, beneficiaryOfMarket, ownerOfDoNFT, adminOfDoNFT,owner, approved, operator, other] = await ethers.getSigners();
        const Market = await ethers.getContractFactory("MarketV2");
        market = await Market.deploy();
        await market.initialize(ownerOfMarket.address, adminOfMarket.address, beneficiaryOfMarket.address);

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
        await doNFTWrap.initialize("doWrap", "doWrap", market.address, ownerOfDoNFT.address, adminOfDoNFT.address);

        await testERC721.connect(owner).setApprovalForAll(doNFTWrap.address, true);
        await testERC721.mint(owner.address, firstTokenId);
        await testERC721.mint(owner.address, secondTokenId);
        await testERC721.connect(owner).setApprovalForAll(w4907.address, true);
        
    })

    describe('mintVNft', function () {
        let receipt = null;
        beforeEach(async function () {
            await testERC721.connect(owner).approve(approved.address, firstTokenId);
            await testERC721.connect(owner).setApprovalForAll(operator.address, true);
        });
        it("mintVNft by owner", async function () {
            receipt = await doNFTWrap.connect(owner).mintVNft(w4907.address,firstTokenId);
            expect(await doNFTWrap.ownerOf(1)).to.be.equal(owner.address);
        });

        it("mintVNft by approved", async function () {
            receipt = await doNFTWrap.connect(approved).mintVNft(w4907.address,firstTokenId);
            expect(await doNFTWrap.ownerOf(1)).to.be.equal(owner.address);
        });
        it("mintVNft by operator", async function () {
            receipt = await doNFTWrap.connect(operator).mintVNft(w4907.address,secondTokenId);
            expect(await doNFTWrap.ownerOf(1)).to.be.equal(owner.address);
        });
        it("mintVNft by other", async function () {
            await expect(doNFTWrap.connect(other).mintVNft(w4907.address,firstTokenId)).to.be.revertedWith("only approved or owner");
        });

        it("should fail when re-mintVNft", async function () {
            receipt = await doNFTWrap.connect(owner).mintVNft(w4907.address,firstTokenId);
            expect(await doNFTWrap.ownerOf(firstTokenId)).to.be.equal(owner.address);
            await expect(doNFTWrap.connect(owner).mintVNft(w4907.address,firstTokenId)).to.be.revertedWith("already minted");
        });

    });

    describe('redeem', function () {
        let receipt = null;
        let doNFTId = 1;
        beforeEach(async function () {
            await doNFTWrap.connect(owner).mintVNft(w4907.address,firstTokenId);
            await doNFTWrap.connect(owner).approve(approved.address, firstTokenId);
            await doNFTWrap.connect(owner).setApprovalForAll(operator.address, true);
        });
        it("redeem by owner", async function () {
            receipt = await doNFTWrap.connect(owner).redeem(doNFTId);
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(owner.address);

            await doNFTWrap.connect(owner).mintVNft(w4907.address,firstTokenId);
            expect(await doNFTWrap.ownerOf(2)).to.be.equal(owner.address);
        });

        it("redeem by approved", async function () {
            receipt = await doNFTWrap.connect(approved).redeem(doNFTId);
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });
        it("redeem by operator", async function () {
            receipt = await doNFTWrap.connect(operator).redeem(doNFTId);
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });
        it("redeem by other", async function () {
            await expect(doNFTWrap.connect(other).redeem(firstTokenId)).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
        });

        it("re-mintVNft after redeem ", async function () {
            receipt = await doNFTWrap.connect(owner).redeem(doNFTId);
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(owner.address);
            await doNFTWrap.connect(owner).mintVNft(w4907.address,firstTokenId);
            expect(await doNFTWrap.ownerOf(2)).to.be.equal(owner.address);
        });

    });



});

