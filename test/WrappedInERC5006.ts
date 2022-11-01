import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";

describe("Test 1155 User Role", function () {
    let alice, bob, carl;
    let test1155;
    let contract;
    let expiry;

    async function checkRecord(rid, tokenId, amount, owner, user, expiry_) {
        let record = await contract.userRecordOf(rid);
        expect(record[0]).equals(tokenId, "tokenId");
        expect(record[1]).equals(owner, "owner");
        expect(record[2]).equals(amount, "amount");
        expect(record[3]).equals(user, "user");
        expect(record[4]).equals(expiry_, "expiry_");
    }

    beforeEach(async function () {
        [alice, bob, carl] = await ethers.getSigners();

        const Test1155 = await ethers.getContractFactory("Test1155");
        test1155 = await Test1155.deploy();

        const WrappedInERC5006 = await ethers.getContractFactory("WrappedInERC5006");
        contract = await WrappedInERC5006.deploy();
        contract.initializeWrap(test1155.address);

        await test1155.setApprovalForAll(contract.address, true);

        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestamp = blockBefore.timestamp;
        expiry = timestamp + 864000;

    });



    describe("", function () {

        it("Should redeem success", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await contract.redeem(1, 100, alice.address);
            expect(await contract.balanceOf(alice.address, 1)).equals(0);
            expect(await test1155.balanceOf(alice.address, 1)).equals(100);
        });

        it("Should redeem fail", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await expect(contract.redeem(1, 101, alice.address)).to.be.revertedWith("ERC1155: burn amount exceeds balance");
        });



        it("Should set user to bob success", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);

            await checkRecord(1, 1, 10, alice.address, bob.address, expiry);

            expect(await contract.usableBalanceOf(bob.address, 1)).equals(10);

            expect(await contract.balanceOf(alice.address, 1)).equals(90);

            expect(await contract.frozenBalanceOf(alice.address, 1)).equals(10);

        });

        it("Should set user to bob fail : balance is not enough", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await expect(contract.createUserRecord(alice.address, bob.address, 1, 101, expiry)).to.be.revertedWith('ERC1155: insufficient balance for transfer');

        });

        it("Should set user to bob fail : only owner or approved", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await expect(contract.createUserRecord(carl.address, bob.address, 1, 110, expiry)).to.be.revertedWith('only owner or approved');

        });

        it("Should deleteUserRecord success", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);

            // await hre.network.provider.send("hardhat_mine", ["0x5a0", "0x3c"]);

            await contract.deleteUserRecord(1);

            await checkRecord(1, 0, 0, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", 0);

            expect(await contract.usableBalanceOf(bob.address, 1)).equals(0);

            expect(await contract.balanceOf(alice.address, 1)).equals(100);

            expect(await contract.frozenBalanceOf(alice.address, 1)).equals(0);

        });


        it("bob should deleteUserRecord fail", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stake(1, 100, alice.address);
            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);

            await expect(contract.connect(bob).deleteUserRecord(1)).to.be.revertedWith("only owner or approved");

        });

        it("Should stakeAndCreateUserRecord success", async function () {
            await test1155.mint(alice.address, 1, 100);

            await contract.stakeAndCreateUserRecord(1, 10, bob.address, expiry);

            await checkRecord(1, 1, 10, alice.address, bob.address, expiry);

            expect(await contract.usableBalanceOf(bob.address, 1)).equals(10);

            expect(await contract.balanceOf(alice.address, 1)).equals(0);

            expect(await contract.frozenBalanceOf(alice.address, 1)).equals(10);

            expect(await test1155.balanceOf(alice.address, 1)).equals(90);

        });

        it("Should redeemRecord success", async function () {
            await test1155.mint(alice.address, 1, 100);
            await contract.stakeAndCreateUserRecord(1, 10, bob.address, expiry);
            await contract.redeemRecord(1, alice.address);
            expect(await contract.balanceOf(alice.address, 1)).equals(0);
            expect(await contract.frozenBalanceOf(alice.address, 1)).equals(0);
            expect(await test1155.balanceOf(alice.address, 1)).equals(100);

        });



    });


});