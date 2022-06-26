import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();

  const testAccount = "0x5483Aab8A704AEE90a8dc2dA8a4956425cfb9b49";

  const TestToken = await ethers.getContractFactory("TestToken");
  const dai = await TestToken.deploy("Dai", "DAI");
  const usdc = await TestToken.deploy("USD Coin", "USDC");
  await dai.deployed();
  await usdc.deployed();

  const mintAmount = ethers.utils.parseEther("10000");

  for (const s of signers) {
    dai.mint(s.address, mintAmount);
    usdc.mint(s.address, mintAmount);
  }
  dai.mint(testAccount, mintAmount);
  usdc.mint(testAccount, mintAmount);

  console.log("dai deployed to:", dai.address);
  console.log("usdc deployed to:", usdc.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
