import { expect } from "chai";
import { ethers } from "hardhat";
const firstTokenId = 1;
const secondTokenId = 2;
const nonExistentTokenId = 79217;
describe("WrappedInERC4907", function () {
    let owner, approved, operator, toUser, other;
    let testERC721;
    let w4907;

    beforeEach(async function () {
        [owner, approved, operator, toUser, other] = await ethers.getSigners();

        const TestERC721 = await ethers.getContractFactory("TestERC721");
        testERC721 = await TestERC721.deploy();
        const WrappedInERC4907 = await ethers.getContractFactory("WrappedInERC4907");
        w4907 = await WrappedInERC4907.deploy("WrappedInERC4907", "w4907", testERC721.address);
    })

    describe("Should supports interfaces : ERC165, ERC721, ERC4907, IWrapNFT", async function () {
        const IERC721_interfaceId = "0x80ac58cd"
        const IERC4907_interfaceId = "0xad092b5c"
        const IWrapNFT_interfaceId = "0xb72080fb"
        const interfaceIds = [IERC721_interfaceId, IERC4907_interfaceId, IWrapNFT_interfaceId]
        describe('ERC165', function () {
            it('all interfaces are reported as supported', async function () {
                for (const interfaceId of interfaceIds) {
                    expect(await w4907.supportsInterface(interfaceId)).to.equal(true);
                }
            });
        });
    });

    describe('stake', function () {
        let receipt = null;
        beforeEach(async function () {
            await testERC721.mint(owner.address, firstTokenId);
            await testERC721.mint(owner.address, secondTokenId);
            await testERC721.approve(approved.address, firstTokenId);
            await testERC721.setApprovalForAll(operator.address, true);
            await testERC721.setApprovalForAll(w4907.address, true);
        });

        it("stake by owner", async function () {
            receipt = await w4907.connect(owner).stake(firstTokenId);
            await expect(receipt).to.emit(w4907, "Stake").withArgs(owner.address, testERC721.address, firstTokenId);
            expect(await w4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(w4907.address);
        });

        it("stake by approved", async function () {
            receipt = await w4907.connect(approved).stake(firstTokenId);
            await expect(receipt).to.emit(w4907, "Stake").withArgs(approved.address, testERC721.address, firstTokenId);
            expect(await w4907.ownerOf(firstTokenId)).to.be.equal(owner.address);
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(w4907.address);
        });
        it("stake by operator", async function () {
            receipt = await w4907.connect(operator).stake(secondTokenId);
            await expect(receipt).to.emit(w4907, "Stake").withArgs(operator.address, testERC721.address, secondTokenId);
            expect(await w4907.ownerOf(secondTokenId)).to.be.equal(owner.address);
            expect(await testERC721.ownerOf(secondTokenId)).to.be.equal(w4907.address);
        });
        it("stake by other", async function () {
            await expect(w4907.connect(other).stake(secondTokenId)).to.be.revertedWith("only approved or owner");
        });
        it("stake nonexistent token", async function () {
            await expect(w4907.connect(other).stake(nonExistentTokenId)).to.be.revertedWith("ERC721: invalid token ID");
        });

    });

    describe('redeem', function () {
        let receipt = null;
        beforeEach(async function () {
            await testERC721.setApprovalForAll(w4907.address, true);
            await testERC721.mint(owner.address, firstTokenId);
            await testERC721.mint(owner.address, secondTokenId);
            await w4907.connect(owner).stake(firstTokenId);
            await w4907.connect(owner).stake(secondTokenId);
            await w4907.approve(approved.address, firstTokenId);
            await w4907.setApprovalForAll(operator.address, true);
        });

        it("redeem by owner", async function () {
            receipt = await w4907.connect(owner).redeem(firstTokenId);
            await expect(receipt).to.emit(w4907, "Redeem").withArgs(owner.address, testERC721.address, firstTokenId);
            await expect(w4907.ownerOf(firstTokenId)).to.be.revertedWith("ERC721: invalid token ID");
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });

        it("redeem by approved", async function () {
            receipt = await w4907.connect(approved).redeem(firstTokenId);
            await expect(receipt).to.emit(w4907, "Redeem").withArgs(approved.address, testERC721.address, firstTokenId);
            await expect(w4907.ownerOf(firstTokenId)).to.be.revertedWith("ERC721: invalid token ID");
            expect(await testERC721.ownerOf(firstTokenId)).to.be.equal(owner.address);
        });
        it("redeem by operator", async function () {
            receipt = await w4907.connect(operator).redeem(secondTokenId);
            await expect(receipt).to.emit(w4907, "Redeem").withArgs(operator.address, testERC721.address, secondTokenId);
            await expect(w4907.ownerOf(secondTokenId)).to.be.revertedWith("ERC721: invalid token ID");
            expect(await testERC721.ownerOf(secondTokenId)).to.be.equal(owner.address);
        });
        it("redeem by other", async function () {
            await expect(w4907.connect(other).redeem(secondTokenId)).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
        });
        it("redeem nonexistent token", async function () {
            await expect(w4907.connect(other).redeem(nonExistentTokenId)).to.be.revertedWith("ERC721: invalid token ID");
        });

    });

    describe('originalOwnerOf', function () {
        beforeEach(async function () {
            await testERC721.setApprovalForAll(w4907.address, true);
            await testERC721.mint(owner.address, firstTokenId);
            await testERC721.mint(owner.address, secondTokenId);
        });
        context('when the given token ID was tracked by this token', function () {
            it('returns the original owner of the oNFT if token has not been staked', async function () {
                expect(await w4907.originalOwnerOf(firstTokenId)).to.be.equal(owner.address);
            });
            it('returns the owner of the wNFT if token has been staked', async function () {
                await w4907.connect(owner).stake(secondTokenId);
                expect(await w4907.originalOwnerOf(secondTokenId)).to.be.equal(owner.address);
            });
        });

        context('when the given token ID was not tracked by this token', function () {
            it('revert with error', async function () {
                await expect(w4907.originalOwnerOf(nonExistentTokenId)).to.be.revertedWith("ERC721: invalid token ID");
            });
        });
    });

    describe('tokenURI', function () {
        beforeEach(async function () {
            await testERC721.setApprovalForAll(w4907.address, true);
            await testERC721.mint(owner.address, firstTokenId);
            await w4907.connect(owner).stake(firstTokenId);
        });

        it('return the tokenURI of oNFT', async function () {
            let original_tokenURI = await testERC721.tokenURI(firstTokenId);
            expect(await w4907.tokenURI(firstTokenId)).to.be.equal(original_tokenURI);
        });
    });

    describe('originalAddress', function () {
        it('return the originalAddress', async function () {
            expect(await w4907.originalAddress()).to.be.equal(testERC721.address);
        });
    });

    describe('userOf', function () {
        beforeEach(async function () {
            await testERC721.setApprovalForAll(w4907.address, true);
            await testERC721.mint(owner.address, firstTokenId);
            await testERC721.mint(owner.address, secondTokenId);
            await w4907.connect(owner).stake(firstTokenId);
            await w4907.connect(owner).stake(secondTokenId);
            await w4907.approve(approved.address, firstTokenId);
            await w4907.setApprovalForAll(operator.address, true);
        });
        context('when the given token ID was tracked by this token', function () {
            it('returns the user of the given token ID if user not expired', async function () {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const timestamp = blockBefore.timestamp;
                const _expires = timestamp + 86400;
                await w4907.setUser(firstTokenId, toUser.address, _expires);
                expect(await w4907.userOf(firstTokenId)).to.be.equal(toUser.address);
                expect(await w4907.userExpires(firstTokenId)).to.be.equal(_expires);
            });

            it('returns ZERO_ADDRESS if user expired', async function () {
                await w4907.setUser(secondTokenId, toUser.address, 0);
                expect(await w4907.userOf(secondTokenId)).to.be.equal(ethers.constants.AddressZero);
                expect(await w4907.userExpires(firstTokenId)).to.be.equal(0);
            });
        });

        context('when the given token ID was not tracked by this token', function () {
            it('returns AddressZero', async function () {
                expect(await w4907.userOf(nonExistentTokenId)).to.be.equal(ethers.constants.AddressZero);
                expect(await w4907.userExpires(nonExistentTokenId)).to.be.equal(0);
            });
        });
    });

    describe('setUser', function () {
        let receipt = null;
        let _expires;
        beforeEach(async function () {
            await testERC721.setApprovalForAll(w4907.address, true);
            await testERC721.mint(owner.address, firstTokenId);
            await testERC721.mint(owner.address, secondTokenId);
            await w4907.connect(owner).stake(firstTokenId);
            await w4907.connect(owner).stake(secondTokenId);
            await w4907.approve(approved.address, firstTokenId);
            await w4907.setApprovalForAll(operator.address, true);
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestamp = blockBefore.timestamp;
            _expires = timestamp + 86400;
        });

        it("set user by approved", async function () {
            receipt = await w4907.connect(approved).setUser(firstTokenId, toUser.address, _expires);
            await expect(receipt).to.emit(w4907, "UpdateUser").withArgs(firstTokenId, toUser.address, _expires);
            expect(await w4907.userOf(firstTokenId)).to.be.equal(toUser.address);
        });
        it("set user by operator", async function () {
            receipt = await w4907.connect(operator).setUser(secondTokenId, toUser.address, _expires);
            await expect(receipt).to.emit(w4907, "UpdateUser").withArgs(secondTokenId, toUser.address, _expires);
            expect(await w4907.userOf(secondTokenId)).to.be.equal(toUser.address);
        });
        it("set user by other", async function () {
            await expect(w4907.connect(other).setUser(secondTokenId, toUser.address, _expires)).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
        });

    });


});

