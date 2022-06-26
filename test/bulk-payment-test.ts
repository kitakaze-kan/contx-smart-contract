/* eslint-disable node/no-missing-import */
import { web3 } from "@openzeppelin/test-environment";
import { expect } from "chai";
import { ethers, testUtils } from "hardhat";
import type { BulkPayment, TestToken } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// eslint-disable-next-line node/no-extraneous-import
import { FixedNumber } from "@ethersproject/bignumber";

const MAX_UINT256 = testUtils.constants.MAX_UINT256.toString();
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DELIVERABLE = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "bafybeielp6b4nzcev7ztsuwujsxsli5mncfkmzy6axfhlnmyk5wficqnie"
  )
);
const protocolFeeRate: FixedNumber = FixedNumber.from("1.00875");
const { fromWei, toWei } = web3.utils;

describe("bulkPayment", () => {
  let bulkPayment: BulkPayment;
  let dai: TestToken;
  let usdc: TestToken;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let grant1: SignerWithAddress;
  let grant2: SignerWithAddress;
  let grant3: SignerWithAddress;
  let withdrawal: SignerWithAddress;

  beforeEach(async () => {
    const BulkPayment = await ethers.getContractFactory("BulkPayment");
    const TestToken = await ethers.getContractFactory("TestToken");
    [owner, user, grant1, grant2, grant3, withdrawal] =
      await ethers.getSigners();

    // Deploy bulk checkout contract
    bulkPayment = await BulkPayment.deploy();
    await bulkPayment.deployed();

    // Deploy a few test tokens
    dai = await TestToken.deploy("Dai", "DAI");
    usdc = await TestToken.deploy("USD Coin", "USDC");
    await dai.deployed();
    await usdc.deployed();

    // Mint a bunch to the user
    const mintAmount = toWei("100");
    dai.mint(user.address, mintAmount);
    usdc.mint(user.address, mintAmount);

    // Approve bulkPayment contract to spend our tokens
    dai.connect(user).approve(bulkPayment.address, MAX_UINT256);
    usdc.connect(user).approve(bulkPayment.address, MAX_UINT256);
  });

  // ======================================= Initialization ========================================
  it("should see the deployed bulkPayment contract", async () => {
    // eslint-disable-next-line no-unused-expressions
    expect(bulkPayment.address.startsWith("0x")).to.be.true;
    expect(bulkPayment.address.length).to.equal(42);
  });

  it("sets the owner upon deployment", async () => {
    console.log("owner", owner.address);
    console.log("await bulkPayment.owner()", await bulkPayment.owner());
    expect(await bulkPayment.owner()).to.equal(owner.address);
  });

  // ====================================== Single payments =======================================
  it("lets the user submit only one donation for a token", async () => {
    const val = "5";
    const amount = FixedNumber.from(val).mulUnsafe(protocolFeeRate);
    console.log("amount", toWei(amount._value));

    const payments = [
      {
        token: dai.address,
        amount: toWei(amount._value),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
    ];
    const receipt = await bulkPayment.connect(user).pay(payments);
    const expectedUserBalance = FixedNumber.from("100").subUnsafe(amount);
    console.log("expectedUserBalance", expectedUserBalance._value);
    console.log(
      "acutualUserBalance",
      fromWei(await (await dai.balanceOf(user.address)).toString())
    );
    console.log(
      "acutualGrant1Balance",
      fromWei(await (await dai.balanceOf(grant1.address)).toString())
    );

    expect(
      fromWei(await (await dai.balanceOf(user.address)).toString())
    ).to.equal(expectedUserBalance._value);
    expect(
      fromWei(await (await dai.balanceOf(grant1.address)).toString())
    ).to.equal(val);
    await expect(receipt)
      .to.emit(bulkPayment, "PaymentSent")
      .withArgs(
        payments[0].token,
        toWei(val),
        payments[0].dest,
        payments[0].deliverable,
        user.address
      );
  });

  it("lets the user submit only one donation of ETH", async () => {
    const val = "5";
    const amount = FixedNumber.from(val).mulUnsafe(protocolFeeRate);
    const payments = [
      {
        token: ETH_ADDRESS,
        amount: toWei(amount._value),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
    ];
    const receipt = await bulkPayment.connect(user).pay(payments, {
      value: toWei(amount.toString()),
    });
    expect(
      fromWei((await testUtils.address.balance(grant1.address)).toString())
    ).to.equal("10005");
    await expect(receipt)
      .to.emit(bulkPayment, "PaymentSent")
      .withArgs(
        payments[0].token,
        toWei(val),
        payments[0].dest,
        payments[0].deliverable,
        user.address
      );
  });

  // ======================================= Bulk payments ========================================
  it("lets the user submit multiple payments of the same token", async () => {
    const val = "5";
    const amount = FixedNumber.from(val).mulUnsafe(protocolFeeRate);
    const val10 = "10";
    const amount10 = FixedNumber.from(val10).mulUnsafe(protocolFeeRate);
    const val25 = "25";
    const amount25 = FixedNumber.from(val25).mulUnsafe(protocolFeeRate);

    const payments = [
      {
        token: dai.address,
        amount: toWei(amount._value),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
      {
        token: dai.address,
        amount: toWei(amount10._value),
        dest: grant2.address,
        deliverable: DELIVERABLE,
      },
      {
        token: dai.address,
        amount: toWei(amount25._value),
        dest: grant3.address,
        deliverable: DELIVERABLE,
      },
    ];

    await bulkPayment.connect(user).pay(payments);

    const totalAmount = amount.addUnsafe(amount10).addUnsafe(amount25);
    const expectedUserBalance = FixedNumber.from("100").subUnsafe(totalAmount);

    expect(
      fromWei(await (await dai.balanceOf(user.address)).toString())
    ).to.equal(expectedUserBalance._value);
    expect(
      fromWei(await (await dai.balanceOf(grant1.address)).toString())
    ).to.equal("5");
    expect(
      fromWei(await (await dai.balanceOf(grant2.address)).toString())
    ).to.equal("10");
    expect(
      fromWei(await (await dai.balanceOf(grant3.address)).toString())
    ).to.equal("25");
  });

  it("lets the user submit multiple payments of different tokens", async () => {
    const val = "5";
    const amount = FixedNumber.from(val).mulUnsafe(protocolFeeRate);
    const val10 = "10";
    const amount10 = FixedNumber.from(val10).mulUnsafe(protocolFeeRate);
    const val25 = "25";
    const amount25 = FixedNumber.from(val25).mulUnsafe(protocolFeeRate);

    const payments = [
      {
        token: dai.address,
        amount: toWei(amount._value),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
      {
        token: dai.address,
        amount: toWei(amount10._value),
        dest: grant2.address,
        deliverable: DELIVERABLE,
      },
      {
        token: usdc.address,
        amount: toWei(amount25._value),
        dest: grant3.address,
        deliverable: DELIVERABLE,
      },
    ];
    await bulkPayment.connect(user).pay(payments);

    const totalDaiAmount = amount.addUnsafe(amount10);
    const expectedUserDaiBalance =
      FixedNumber.from("100").subUnsafe(totalDaiAmount);

    const expectedUserUSDCBalance = FixedNumber.from("100").subUnsafe(amount25);

    expect(
      fromWei(await (await dai.balanceOf(user.address)).toString())
    ).to.equal(expectedUserDaiBalance._value);
    expect(
      fromWei(await (await usdc.balanceOf(user.address)).toString())
    ).to.equal(expectedUserUSDCBalance._value);
    expect(
      fromWei(await (await dai.balanceOf(grant1.address)).toString())
    ).to.equal("5");
    expect(
      fromWei(await (await dai.balanceOf(grant2.address)).toString())
    ).to.equal("10");
    expect(
      fromWei(await (await usdc.balanceOf(grant3.address)).toString())
    ).to.equal("25");
  });

  it("lets the user submit multiple payments of only ETH", async () => {
    const val = "5";
    const amount = FixedNumber.from(val).mulUnsafe(protocolFeeRate);
    const val10 = "10";
    const amount10 = FixedNumber.from(val10).mulUnsafe(protocolFeeRate);
    const val15 = "15";
    const amount15 = FixedNumber.from(val15).mulUnsafe(protocolFeeRate);

    const payments = [
      {
        token: ETH_ADDRESS,
        amount: toWei(amount._value),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
      {
        token: ETH_ADDRESS,
        amount: toWei(amount15._value),
        dest: grant2.address,
        deliverable: DELIVERABLE,
      },
      {
        token: ETH_ADDRESS,
        amount: toWei(amount10._value),
        dest: grant3.address,
        deliverable: DELIVERABLE,
      },
    ];
    const totalAmount = amount.addUnsafe(amount10).addUnsafe(amount15);

    await bulkPayment
      .connect(user)
      .pay(payments, { value: toWei(totalAmount._value) });

    const feeTotal = fromWei(
      await (await testUtils.address.balance(bulkPayment.address)).toString()
    );
    console.log("fee", feeTotal);

    expect(
      fromWei(
        await (await testUtils.address.balance(grant1.address)).toString()
      )
    ).to.equal("10010");

    expect(
      fromWei(
        await (await testUtils.address.balance(grant2.address)).toString()
      )
    ).to.equal("10015");

    expect(
      fromWei(
        await (await testUtils.address.balance(grant3.address)).toString()
      )
    ).to.equal("10010");
  });

  it("lets the user submit multiple payments as mix of tokens and ETH", async () => {
    const val = "5";
    const amount = FixedNumber.from(val).mulUnsafe(protocolFeeRate);
    const val10 = "10";
    const amount10 = FixedNumber.from(val10).mulUnsafe(protocolFeeRate);
    const val25 = "25";
    const amount25 = FixedNumber.from(val25).mulUnsafe(protocolFeeRate);

    const payments = [
      {
        token: dai.address,
        amount: toWei(amount._value),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
      {
        token: ETH_ADDRESS,
        amount: toWei(amount10._value),
        dest: grant2.address,
        deliverable: DELIVERABLE,
      },
      {
        token: usdc.address,
        amount: toWei(amount25._value),
        dest: grant3.address,
        deliverable: DELIVERABLE,
      },
    ];
    await bulkPayment
      .connect(user)
      .pay(payments, { value: toWei(amount10._value) });

    const expectedUserDaiBalance = FixedNumber.from("100").subUnsafe(amount);
    const expectedUserUSDCBalance = FixedNumber.from("100").subUnsafe(amount25);
    expect(
      fromWei(await (await dai.balanceOf(user.address)).toString())
    ).to.equal(expectedUserDaiBalance._value);

    expect(
      fromWei(await (await usdc.balanceOf(user.address)).toString())
    ).to.equal(expectedUserUSDCBalance._value);
    expect(
      fromWei(await (await dai.balanceOf(grant1.address)).toString())
    ).to.equal("5");
    expect(
      fromWei(
        await (await testUtils.address.balance(grant2.address)).toString()
      )
    ).to.equal("10025");
    expect(
      fromWei(await (await usdc.balanceOf(grant3.address)).toString())
    ).to.equal("25");
  });

  // =================================== Donation Error Handling ===================================
  it("reverts if too much ETH is sent", async () => {
    const payments = [
      {
        token: ETH_ADDRESS,
        amount: toWei("5"),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
    ];
    await expect(
      bulkPayment.connect(user).pay(payments, { value: toWei("50") })
    ).to.revertedWith("bulkPayment: Too much ETH sent");
  });

  it("reverts if too little ETH is sent", async () => {
    const payments = [
      {
        token: ETH_ADDRESS,
        amount: toWei("5"),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
    ];
    await expect(
      bulkPayment.connect(user).pay(payments, { value: toWei("0.5") })
    ).to.revertedWith("Address: insufficient balance");
  });

  // ======================================== Admin Actions ========================================
  it("lets ownership be transferred by the owner", async () => {
    expect(await bulkPayment.owner()).to.equal(owner.address);
    await bulkPayment.connect(owner).transferOwnership(user.address);
    expect(await bulkPayment.owner()).to.equal(user.address);
  });

  it("does not let anyone except the owner transfer ownership", async () => {
    await expect(
      bulkPayment.connect(user).transferOwnership(user.address)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("lets the owner pause and unpause the contract", async () => {
    // Contract not paused. Make sure we cannot unpause
    expect(await bulkPayment.paused()).to.equal(false);
    await expect(bulkPayment.connect(owner).unpause()).to.revertedWith(
      "Pausable: not paused"
    );

    // Pause it and make sure we can no longer send payments
    await bulkPayment.connect(owner).pause();
    expect(await bulkPayment.paused()).to.equal(true);
    const payments = [
      {
        token: ETH_ADDRESS,
        amount: toWei("5"),
        dest: grant1.address,
        deliverable: DELIVERABLE,
      },
    ];
    await expect(
      bulkPayment.connect(user).pay(payments, { value: toWei("5") })
    ).to.revertedWith("Pausable: paused");

    // Unpause and make sure everything still works
    await bulkPayment.connect(owner).unpause();
    await bulkPayment.connect(user).pay(payments, { value: toWei("5") });
  });

  it("does not let anyone except the owner pause the contract", async () => {
    // Contract not paused. Make sure user cannot pause it
    expect(await bulkPayment.paused()).to.equal(false);
    await expect(bulkPayment.connect(user).pause()).to.revertedWith(
      "Ownable: caller is not the owner"
    );
    // Pause contract and make sure user cannot unpause it
    await bulkPayment.connect(owner).pause();
    expect(await bulkPayment.paused()).to.equal(true);

    await expect(bulkPayment.connect(user).unpause()).to.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("lets only the owner recover stray tokens accidentally sent to the contract", async () => {
    // Send Dai to the contract
    dai.mint(bulkPayment.address, toWei("10"));

    expect(
      fromWei(await (await dai.balanceOf(bulkPayment.address)).toString())
    ).to.equal("10");

    // Make sure user cannot withdrawn the tokens
    await expect(
      bulkPayment.connect(user).withdrawToken(dai.address, withdrawal.address)
    ).to.revertedWith("Ownable: caller is not the owner");

    // Make sure owner can withdraw
    expect(
      fromWei(await (await dai.balanceOf(withdrawal.address)).toString())
    ).to.equal("0");

    const receipt = await bulkPayment
      .connect(owner)
      .withdrawToken(dai.address, withdrawal.address);

    expect(
      fromWei(await (await dai.balanceOf(withdrawal.address)).toString())
    ).to.equal("10");
    await expect(receipt)
      .to.emit(bulkPayment, "TokenWithdrawn")
      .withArgs(dai.address, toWei("10"), withdrawal.address);
  });
});
