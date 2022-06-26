import { ethers } from "hardhat";

async function main() {
  const BulkPayment = await ethers.getContractFactory("BulkPayment");
  const bulkPayment = await BulkPayment.deploy();

  await bulkPayment.deployed();

  console.log("bulkPayment deployed to:", bulkPayment.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
