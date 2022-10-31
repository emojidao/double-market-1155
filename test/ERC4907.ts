import { expect } from "chai";
import { ethers } from "hardhat";
const firstTokenId = 1;
const secondTokenId = 2;
const nonExistentTokenId = 79217;
describe("ERC4907", function () {
    let owner, approved, operator, toUser, other;
    let testERC4907;

    beforeEach(async function () {
        [owner, approved, operator, toUser, other] = await ethers.getSigners();
        const TestERC4907 = await ethers.getContractFactory("TestERC4907");
        testERC4907 = await TestERC4907.deploy();
        await testERC4907.mint(owner.address, firstTokenId);
        await testERC4907.mint(owner.address, secondTokenId);
    })

    describe("Should supports interfaces : ERC165, ERC721, ERC4907", async function () {
        const IERC721_interfaceId = "0x80ac58cd"
        const IERC4907_interfaceId = "0xad092b5c"
        const interfaceIds = [IERC721_interfaceId, IERC4907_interfaceId]
        describe('ERC165', function () {
            it('all interfaces are reported as supported', async function () {
                for (const interfaceId of interfaceIds) {
                    expect(await testERC4907.supportsInterface(interfaceId)).to.equal(true);
                }
            });
        });
    });

    describe('userOf', function () {
        context('when the given token ID was tracked by this token', function () {
            it('returns the user of the given token ID if user not expired', async function () {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                const timestamp = blockBefore.timestamp;
                const _expires = timestamp + 86400;
                await testERC4907.setUser(firstTokenId, toUser.address, _expires);
                expect(await testERC4907.userOf(firstTokenId)).to.be.equal(toUser.address);
                expect(await testERC4907.userExpires(firstTokenId)).to.be.equal(_expires);
            });

            it('returns ZERO_ADDRESS if user expired', async function () {
                await testERC4907.setUser(secondTokenId, toUser.address, 0);
                expect(await testERC4907.userOf(secondTokenId)).to.be.equal(ethers.constants.AddressZero);
                expect(await testERC4907.userExpires(firstTokenId)).to.be.equal(0);
            });
        });

        context('when the given token ID was not tracked by this token', function () {
            it('returns AddressZero', async function () {
                expect(await testERC4907.userOf(nonExistentTokenId)).to.be.equal(ethers.constants.AddressZero);
                expect(await testERC4907.userExpires(nonExistentTokenId)).to.be.equal(0);
            });
        });
    });

    describe('setUser', function () {
        let receipt = null;
        let _expires;
        beforeEach(async function () {
            await testERC4907.approve(approved.address, firstTokenId);
            await testERC4907.setApprovalForAll(operator.address, true);
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestamp = blockBefore.timestamp;
            _expires = timestamp + 86400;
        });

        it("set user by approved", async function () {
            receipt = await testERC4907.connect(approved).setUser(firstTokenId, toUser.address, _expires);
            await expect(receipt).to.emit(testERC4907, "UpdateUser").withArgs(firstTokenId, toUser.address, _expires);
            expect(await testERC4907.userOf(firstTokenId)).to.be.equal(toUser.address);
        });
        it("set user by operator", async function () {
            receipt = await testERC4907.connect(operator).setUser(secondTokenId, toUser.address, _expires);
            await expect(receipt).to.emit(testERC4907, "UpdateUser").withArgs(secondTokenId, toUser.address, _expires);
            expect(await testERC4907.userOf(secondTokenId)).to.be.equal(toUser.address);
        });
        it("set user by other", async function () {
            await expect(testERC4907.connect(other).setUser(secondTokenId, toUser.address, _expires)).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
        });

    });

    describe('_burn', function () {
        let receipt = null;
        let _expires;
        beforeEach(async function () {
            await testERC4907.approve(approved.address, firstTokenId);
            await testERC4907.setApprovalForAll(operator.address, true);
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestamp = blockBefore.timestamp;
            _expires = timestamp + 86400;
        });

        it("set user by approved", async function () {
            receipt = await testERC4907.connect(approved).burn(firstTokenId);
            await expect(receipt).to.emit(testERC4907, "UpdateUser").withArgs(firstTokenId, ethers.constants.AddressZero, 0);
            expect(await testERC4907.userOf(firstTokenId)).to.be.equal(ethers.constants.AddressZero);
        });
        it("set user by operator", async function () {
            receipt = await testERC4907.connect(operator).burn(secondTokenId);
            await expect(receipt).to.emit(testERC4907, "UpdateUser").withArgs(secondTokenId, ethers.constants.AddressZero, 0);
            expect(await testERC4907.userOf(secondTokenId)).to.be.equal(ethers.constants.AddressZero);
        });
        it("set user by other", async function () {
            await expect(testERC4907.connect(other).burn(secondTokenId)).to.be.revertedWith("ERC721: caller is not owner nor approved");
        });

    });


});

