import { expect } from "chai";
import { ethers } from "hardhat";
const firstTokenId = 1;
const secondTokenId = 2;
describe("DoubleFactory", function () {
    let ownerOfMarket, adminOfMarket, beneficiaryOfMarket;
    let ownerOfFactory, adminOfFactory;
    let other;
    let market;
    let wNFTImpl;
    let factory;
    let testERC721;
    let testERC4907;
    let testERC1155;

    beforeEach(async function () {
        [ownerOfMarket, adminOfMarket, beneficiaryOfMarket, ownerOfFactory, adminOfFactory, other] = await ethers.getSigners();
        const Market = await ethers.getContractFactory("MarketV2");
        market = await Market.deploy();
        await market.initialize(ownerOfMarket.address, adminOfMarket.address, beneficiaryOfMarket.address);

        const WrappedInERC4907Upgradeable = await ethers.getContractFactory("WrappedInERC4907Upgradeable");
        wNFTImpl = await WrappedInERC4907Upgradeable.deploy();

        const DoubleFactory = await ethers.getContractFactory("DoubleFactory");
        factory = await DoubleFactory.deploy(ownerOfFactory.address, adminOfFactory.address, wNFTImpl.address);

        const TestERC721 = await ethers.getContractFactory("TestERC721");
        testERC721 = await TestERC721.deploy();

        const TestERC4907Upgradeable = await ethers.getContractFactory("TestERC4907Upgradeable");
        testERC4907 = await TestERC4907Upgradeable.deploy();

        const TestERC1155Upgradeable = await ethers.getContractFactory("TestERC1155Upgradeable");
        testERC1155 = await TestERC1155Upgradeable.deploy();

    })

    describe('deploy WNFT', function () {
        let receipt = null;
        it("should success if original contract is ERC721", async function () {
            receipt = await factory.connect(other).deployWNFT("name","symbol",testERC721.address);
            await expect(receipt).to.emit(factory, "DeployWNFT");
        });
        it("should fail if original contract is ERC4907", async function () {
            await expect(factory.connect(other).deployWNFT("name","symbol",testERC4907.address)).to.be.revertedWith("the NFT is IERC4907 already");
        });
        it("should fail if original is not ERC721", async function () {
            
            await expect(factory.connect(other).deployWNFT("name","symbol",testERC1155.address)).to.be.revertedWith("not ERC721");
        });

    });

    describe("setWNFTImpl", function () {
        let new_wNFTImpl;
        beforeEach(async function () {
            const WrappedInERC4907Upgradeable = await ethers.getContractFactory("WrappedInERC4907Upgradeable");
            new_wNFTImpl = await WrappedInERC4907Upgradeable.deploy();
        });
        it("should success if caller is owner of factory", async function () {
            await factory.connect(ownerOfFactory).setWNFTImpl(new_wNFTImpl.address);
            expect(await factory.wNFTImpl()).equal(new_wNFTImpl.address);
        });
        it("should success if caller is admin of factory", async function () {
            await factory.connect(adminOfFactory).setWNFTImpl(new_wNFTImpl.address);
            expect(await factory.wNFTImpl()).equal(new_wNFTImpl.address);
        });

        it("should fail if caller is not owner", async function () {
            await expect(factory.connect(other).setWNFTImpl(new_wNFTImpl.address)).to.be.revertedWith("onlyAdmin");
        });

    })

});

