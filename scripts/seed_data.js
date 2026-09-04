const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function seed() {
  console.log("Seeding on-chain demonstration data for Admin Dashboard...");
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployment.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const relayerWallet = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );
  const contract = new ethers.Contract(deployment.contractAddress, deployment.abi, relayerWallet);

  const mizanAddress = ethers.getAddress("0xc8cd9300c0174353255140eeb9e3864a7541d99c");
  const aliceAddress = ethers.getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const auditorAddress = ethers.getAddress("0x90F79bf6EB2c4f870365E785982E1f101E93b906");

  async function sendTx(contractMethod, ...args) {
    const rawNonceHex = await provider.send("eth_getTransactionCount", [
      relayerWallet.address,
      "latest",
    ]);
    const nonce = parseInt(rawNonceHex, 16);
    const tx = await contract[contractMethod](...args, { nonce });
    return await tx.wait();
  }

  // 1. Grant AUDITOR_ROLE to auditor address
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const hasAuditor = await contract.hasRole(AUDITOR_ROLE, auditorAddress);
  if (!hasAuditor) {
    console.log("Assigning AUDITOR_ROLE to:", auditorAddress);
    await sendTx("grantRole", AUDITOR_ROLE, auditorAddress);
  }

  // 2. Register Identity for Mizan
  console.log("Registering identity for Mizan:", mizanAddress);
  await sendTx("registerIdentity", mizanAddress, `did:ethr:${mizanAddress}`);

  // 3. Register Identity for Alice
  console.log("Registering identity for Alice:", aliceAddress);
  await sendTx("registerIdentity", aliceAddress, `did:ethr:${aliceAddress}`);

  // 4. Mint Driving License #2 for Mizan
  console.log("Minting Driving License credential for Mizan...");
  const mizanMetadata = {
    name: "Driving License #2 - Mizan",
    description: "Decentralized digital asset credential (Driving License) verified on-chain.",
    image: `https://api.dicebear.com/7.x/identicon/svg?seed=${mizanAddress}`,
    assetType: "Driving License",
    issuedAt: new Date().toISOString(),
    issuer: relayerWallet.address,
    recipient: mizanAddress,
    attributes: [
      { trait_type: "licenseNumber", value: "DL-NY-2026-90412" },
      { trait_type: "fullName", value: "Mizan" },
      { trait_type: "category", value: "Class B / Commercial" },
      { trait_type: "issueDate", value: "2025-01-15" },
      { trait_type: "expiryDate", value: "2035-01-15" },
      { trait_type: "issuingAuthority", value: "New York DMV" },
    ],
  };
  const tokenURIMizan = `data:application/json;base64,${Buffer.from(JSON.stringify(mizanMetadata)).toString("base64")}`;
  await sendTx("mintDigitalAsset", mizanAddress, tokenURIMizan);

  // 5. Mint Academic Degree NFT for Alice
  console.log("Minting Academic Degree credential for Alice...");
  const aliceMetadata = {
    name: "B.Sc. Computer Science - Alice Vance",
    description: "Decentralized digital asset credential (University Degree) verified on-chain.",
    image: `https://api.dicebear.com/7.x/identicon/svg?seed=${aliceAddress}`,
    assetType: "Academic Degree",
    issuedAt: new Date().toISOString(),
    issuer: relayerWallet.address,
    recipient: aliceAddress,
    attributes: [
      { trait_type: "degree", value: "Bachelor of Science" },
      { trait_type: "fullName", value: "Alice Vance" },
      { trait_type: "major", value: "Computer Science & Cryptography" },
      { trait_type: "graduationYear", value: "2024" },
      { trait_type: "honors", value: "Summa Cum Laude" },
      { trait_type: "issuingAuthority", value: "MIT Academic Registrar" },
    ],
  };
  // 6. Mint Software License NFT for Mizan
  console.log("Minting Software License credential for Mizan...");
  const softwareLicenseMetadata = {
    name: "Enterprise Software License - AetherID Cloud",
    description: "Decentralized enterprise software license token with tier-1 SLA permissions.",
    image: `https://api.dicebear.com/7.x/identicon/svg?seed=SoftwareLicenseMizan`,
    assetType: "Software License",
    issuedAt: new Date().toISOString(),
    issuer: relayerWallet.address,
    recipient: mizanAddress,
    attributes: [
      { trait_type: "product", value: "AetherID Cloud Core" },
      { trait_type: "tier", value: "Enterprise Unlimited" },
      { trait_type: "fullName", value: "Mizan" },
      { trait_type: "licenseKey", value: "AETH-ENT-2026-99042" },
      { trait_type: "validUntil", value: "2030-12-31" },
      { trait_type: "issuingAuthority", value: "AetherID Foundation" },
    ],
  };
  const tokenURISoftware = `data:application/json;base64,${Buffer.from(JSON.stringify(softwareLicenseMetadata)).toString("base64")}`;
  await sendTx("mintDigitalAsset", mizanAddress, tokenURISoftware);

  // 7. Mint Digital Certificate NFT for Rahul
  console.log("Minting Digital Certificate for Rahul...");
  const certMetadata = {
    name: "Certified Blockchain Architect - Rahul",
    description: "Professional certification credential verifying smart contract auditing proficiency.",
    image: `https://api.dicebear.com/7.x/identicon/svg?seed=0x70997970C51812dc3A010C7d01b50e0d17dc79C8`,
    assetType: "Digital Certificate",
    issuedAt: new Date().toISOString(),
    issuer: relayerWallet.address,
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    attributes: [
      { trait_type: "certification", value: "Certified Blockchain Architect" },
      { trait_type: "fullName", value: "Rahul" },
      { trait_type: "credentialId", value: "CBA-ETH-88219" },
      { trait_type: "issuingAuthority", value: "Global Blockchain Council" },
    ],
  };
  const tokenURICert = `data:application/json;base64,${Buffer.from(JSON.stringify(certMetadata)).toString("base64")}`;
  await sendTx("mintDigitalAsset", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", tokenURICert);

  console.log("Seeding complete! On-chain state populated.");
}

seed().catch(console.error);
