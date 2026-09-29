const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment of IdentityAssetManager...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error(
      `Deployer account (${deployer.address}) has 0 ETH on ${hre.network.name}! Please ensure the account is funded before deploying.`
    );
  }

  const IdentityAssetManager = await hre.ethers.getContractFactory("IdentityAssetManager");
  const contract = await IdentityAssetManager.deploy(deployer.address);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("IdentityAssetManager deployed to:", contractAddress);

  // Read ABI from Hardhat artifact
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/IdentityAssetManager.sol/IdentityAssetManager.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const deploymentData = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const outputPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log("Deployment information successfully saved to:", outputPath);

  // Ensure committed ABI file stays in sync
  const staticAbiPath = path.join(__dirname, "../contracts/IdentityAssetManager.abi.json");
  fs.writeFileSync(staticAbiPath, JSON.stringify(artifact.abi, null, 2));

  console.log("\n========================================================");
  console.log("✅ Deployment Complete!");
  console.log("Network:", hre.network.name);
  console.log("Contract Address:", contractAddress);
  console.log("Next step: Start local Express backend with `npm start`");
  console.log("========================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
