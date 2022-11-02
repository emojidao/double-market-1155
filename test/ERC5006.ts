import { expect } from "chai";
import { ethers } from "hardhat";

describe("ERC5006", function () {
    let alice, bob, carl;
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
        const TestERC5006 = await ethers.getContractFactory("TestERC5006");
        contract = await TestERC5006.deploy("", 3);
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestamp = blockBefore.timestamp;
        expiry = timestamp + 864000;
    });



    describe("", function () {

        it("supportsInterface : IERC5006, IERC1155, IERC1155Receiver", async function () {
            const IERC1155_interfaceId = "0xd9b67a26"
            const IERC5006_interfaceId = "0xc26d96cc"
            const IERC1155Receiver_interfaceId = "0x4e2312e0"
            const IERC1155Receiver_onERC1155BatchReceived_selector = "0xbc197c81"
            expect(await contract.supportsInterface(IERC5006_interfaceId)).equals(true);
            expect(await contract.supportsInterface(IERC1155_interfaceId)).equals(true);
            expect(await contract.supportsInterface(IERC1155Receiver_interfaceId)).equals(true);
            expect(await contract.onERC1155BatchReceived(alice.address,alice.address,[1],[],[])).equals(IERC1155Receiver_onERC1155BatchReceived_selector);
        });

        it("Should set user to bob success", async function () {

            await contract.mint(alice.address, 1, 100);

            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);

            await checkRecord(1, 1, 10, alice.address, bob.address, expiry);

            expect(await contract.usableBalanceOf(bob.address, 1)).equals(10);

            expect(await contract.balanceOf(alice.address, 1)).equals(90);

            expect(await contract.frozenBalanceOf(alice.address, 1)).equals(10);

        });

        it("Should set user to bob fail", async function () {

            await contract.mint(alice.address, 1, 100);

            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);
            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);
            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);
            await expect(contract.createUserRecord(alice.address, bob.address, 1, 10, expiry)).to.be.revertedWith("user cannot have more records");

        });

        it("Should set user to bob fail : balance is not enough", async function () {

            await contract.mint(alice.address, 1, 100);

            await expect(contract.createUserRecord(alice.address, bob.address, 1, 101, expiry)).to.be.revertedWith('ERC1155: insufficient balance for transfer');

        });

        it("Should set user to bob fail : only owner or approved", async function () {

            await contract.mint(alice.address, 1, 100);
            await contract.mint(carl.address, 1, 100);

            await expect(contract.createUserRecord(carl.address, bob.address, 1, 110, expiry)).to.be.revertedWith('only owner or approved');

        });

        it("Should deleteUserRecord success", async function () {

            await contract.mint(alice.address, 1, 100);

            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);

            // await hre.network.provider.send("hardhat_mine", ["0x5a0", "0x3c"]);

            await contract.deleteUserRecord(1);

            await checkRecord(1, 0, 0, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", 0);

            expect(await contract.usableBalanceOf(bob.address, 1)).equals(0);

            expect(await contract.balanceOf(alice.address, 1)).equals(100);

            expect(await contract.frozenBalanceOf(alice.address, 1)).equals(0);

        });


        it("bob should deleteUserRecord fail", async function () {

            await contract.mint(alice.address, 1, 100);

            await contract.createUserRecord(alice.address, bob.address, 1, 10, expiry);

            await expect(contract.connect(bob).deleteUserRecord(1)).to.be.revertedWith("only owner or approved");

        });


    });


});