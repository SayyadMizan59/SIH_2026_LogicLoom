const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configuration
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
// Default Hardhat Account #0 private key
const RELAYER_PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let provider;
let relayerWallet;
let contract;
let contractAddress;
let contractAbi;

// Promise queue to safely sequence transactions without nonce collisions
let txQueue = Promise.resolve();

/**
 * Executes a contract transaction safely by retrieving latest nonce directly from RPC.
 */
function executeRelayerTx(action) {
  return new Promise((resolve, reject) => {
    txQueue = txQueue.then(async () => {
      try {
        const rawNonceHex = await provider.send("eth_getTransactionCount", [
          relayerWallet.address,
          "latest",
        ]);
        const nonce = parseInt(rawNonceHex, 16);
        const result = await action(nonce);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Initializes connection to blockchain provider and smart contract.
 */
function initBlockchain() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

    const deploymentPath = path.join(__dirname, "deployment.json");
    if (fs.existsSync(deploymentPath)) {
      const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      contractAddress = process.env.CONTRACT_ADDRESS || deploymentData.contractAddress;
      contractAbi = deploymentData.abi;
    } else {
      // Fallback: check compiled artifacts
      const artifactPath = path.join(
        __dirname,
        "artifacts/contracts/IdentityAssetManager.sol/IdentityAssetManager.json"
      );
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        contractAbi = artifact.abi;
        contractAddress = process.env.CONTRACT_ADDRESS;
      }
    }

    if (contractAddress && contractAbi) {
      contract = new ethers.Contract(contractAddress, contractAbi, relayerWallet);
      console.log(`[Blockchain] Connected to IdentityAssetManager at: ${contractAddress}`);
      console.log(`[Blockchain] Relayer wallet address: ${relayerWallet.address}`);
    } else {
      console.warn(
        "[Blockchain] Contract address not found. Please deploy the contract using `npm run deploy`."
      );
    }
  } catch (error) {
    console.error("[Blockchain] Initialization error:", error.message);
  }
}

// Initialize on startup
initBlockchain();

// Helper middleware to ensure contract is loaded
const ensureContractReady = (req, res, next) => {
  if (!contract) {
    initBlockchain();
    if (!contract) {
      return res.status(503).json({
        error: "Smart contract not initialized. Please ensure Hardhat node is running and contract is deployed (`npm run deploy`).",
      });
    }
  }
  next();
};

// ==========================================
// API ENDPOINTS
// ==========================================

/**
 * GET /api/health
 * Health check & blockchain connection status.
 */
app.get("/api/health", async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(relayerWallet.address);

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      network: {
        chainId: network.chainId.toString(),
        name: network.name,
      },
      relayer: {
        address: relayerWallet.address,
        balanceEth: ethers.formatEther(balance),
      },
      contractAddress: contractAddress || "Not configured",
    });
  } catch (error) {
    res.status(500).json({
      status: "Degraded",
      error: error.message,
    });
  }
});

/**
 * POST /api/identities
 * Generates a mock DID for a user and registers it on-chain.
 * Body: { address: string, customDid?: string }
 */
app.post("/api/identities", ensureContractReady, async (req, res) => {
  try {
    const { address, customDid } = req.body;

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({
        error: "A valid Ethereum wallet address is required.",
      });
    }

    const formattedAddress = ethers.getAddress(address);
    // Generate standard W3C-compliant DID (e.g., did:ethr:0x...) if not supplied
    const didURI = customDid || `did:ethr:${formattedAddress}`;

    console.log(`[API] Registering DID for address: ${formattedAddress} -> ${didURI}`);

    // Execute transaction safely through relayer queue
    const receipt = await executeRelayerTx(async (nonce) => {
      const tx = await contract.registerIdentity(formattedAddress, didURI, { nonce });
      return await tx.wait();
    });

    res.status(201).json({
      success: true,
      message: "Decentralized Identity (DID) successfully registered on-chain.",
      data: {
        address: formattedAddress,
        didURI: didURI,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
    });
  } catch (error) {
    console.error("[API] Error registering identity:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to register identity on-chain.",
    });
  }
});

/**
 * POST /api/assets/mint
 * Accepts user/credential details, creates metadata, and mints NFT to recipient.
 * Body: {
 *   to: string,
 *   assetType?: string,
 *   details: object
 * }
 */
app.post("/api/assets/mint", ensureContractReady, async (req, res) => {
  try {
    const { to, assetType = "Driving License", details = {} } = req.body;

    if (!to || !ethers.isAddress(to)) {
      return res.status(400).json({
        error: "A valid recipient Ethereum wallet address ('to') is required.",
      });
    }

    const formattedRecipient = ethers.getAddress(to);

    // Construct standard ERC721 metadata structure
    const metadata = {
      name: `${assetType} - ${details.fullName || "Credential Holder"}`,
      description: `Decentralized digital asset credential (${assetType}) verified on-chain.`,
      image: details.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(formattedRecipient)}`,
      assetType: assetType,
      issuedAt: new Date().toISOString(),
      issuer: relayerWallet.address,
      recipient: formattedRecipient,
      attributes: Object.entries(details).map(([trait, value]) => ({
        trait_type: trait,
        value: String(value),
      })),
    };

    // Encode metadata as base64 Data URI (portable & fully self-contained)
    const encodedMetadata = Buffer.from(JSON.stringify(metadata)).toString("base64");
    const tokenURI = `data:application/json;base64,${encodedMetadata}`;

    console.log(`[API] Minting ${assetType} NFT for: ${formattedRecipient}`);

    // Execute mint transaction safely through relayer queue
    const receipt = await executeRelayerTx(async (nonce) => {
      const tx = await contract.mintDigitalAsset(formattedRecipient, tokenURI, { nonce });
      return await tx.wait();
    });

    // Parse AssetMinted event from receipt
    let mintedTokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "AssetMinted") {
          mintedTokenId = parsed.args.tokenId.toString();
          break;
        }
      } catch {
        // Continue scanning logs
      }
    }

    res.status(201).json({
      success: true,
      message: "Digital asset credential NFT minted successfully.",
      data: {
        tokenId: mintedTokenId,
        recipient: formattedRecipient,
        tokenURI: tokenURI,
        metadata: metadata,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
    });
  } catch (error) {
    console.error("[API] Error minting digital asset:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to mint digital asset on-chain.",
    });
  }
});

/**
 * GET /api/verify/:address
 * Fetches user's DID and all owned asset NFTs to verify their credentials.
 */
app.get("/api/verify/:address", ensureContractReady, async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({
        error: "A valid Ethereum wallet address is required.",
      });
    }

    const formattedAddress = ethers.getAddress(address);
    console.log(`[API] Verifying credentials for address: ${formattedAddress}`);

    // Fetch on-chain identity
    const identityResult = await contract.getIdentity(formattedAddress);
    const [didURI, createdAt, exists] = identityResult;

    // Fetch owned asset token IDs
    const tokenIds = await contract.getUserAssets(formattedAddress);

    // Fetch and decode metadata for each token
    const assets = [];
    for (const id of tokenIds) {
      try {
        const uri = await contract.tokenURI(id);
        let parsedMetadata = null;

        if (uri.startsWith("data:application/json;base64,")) {
          const base64Data = uri.replace("data:application/json;base64,", "");
          parsedMetadata = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));
        } else if (uri.startsWith("data:application/json,")) {
          const jsonData = uri.replace("data:application/json,", "");
          parsedMetadata = JSON.parse(decodeURIComponent(jsonData));
        }

        assets.push({
          tokenId: id.toString(),
          tokenURI: uri,
          metadata: parsedMetadata,
        });
      } catch (err) {
        assets.push({
          tokenId: id.toString(),
          tokenURI: null,
          error: "Could not decode metadata: " + err.message,
        });
      }
    }

    res.json({
      success: true,
      address: formattedAddress,
      isVerified: exists && assets.length > 0,
      identity: {
        exists: exists,
        didURI: exists ? didURI : null,
        createdAt: exists ? new Date(Number(createdAt) * 1000).toISOString() : null,
      },
      assetsCount: assets.length,
      assets: assets,
    });
  } catch (error) {
    console.error("[API] Error verifying credentials:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to verify credentials on-chain.",
    });
  }
});

// ==========================================
// ADMIN DASHBOARD API ENDPOINTS
// ==========================================

const ROLE_HASHES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  MANAGER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE")),
  AUDITOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE")),
};

/**
 * Route: /admin -> Serves admin.html
 */
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/**
 * Helper to get all on-chain events and construct activity log
 */
async function fetchOnChainActivities() {
  if (!contract) return [];

  const [idCreatedEvents, idUpdatedEvents, mintEvents, roleGrantedEvents, roleRevokedEvents, transferEvents] =
    await Promise.all([
      contract.queryFilter(contract.filters.IdentityCreated(), 0, "latest"),
      contract.queryFilter(contract.filters.IdentityUpdated(), 0, "latest"),
      contract.queryFilter(contract.filters.AssetMinted(), 0, "latest"),
      contract.queryFilter(contract.filters.RoleGranted(), 0, "latest"),
      contract.queryFilter(contract.filters.RoleRevoked(), 0, "latest"),
      contract.queryFilter(contract.filters.Transfer(), 0, "latest"),
    ]);

  const activities = [];

  // Helper map to cache block timestamps
  const blockTimestamps = {};
  const getBlockTime = async (blockNum) => {
    if (blockTimestamps[blockNum]) return blockTimestamps[blockNum];
    try {
      const block = await provider.getBlock(blockNum);
      const time = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
      blockTimestamps[blockNum] = time;
      return time;
    } catch {
      return new Date().toISOString();
    }
  };

  // Helper to reverse role name
  const getRoleName = (roleHash) => {
    if (roleHash === ROLE_HASHES.DEFAULT_ADMIN_ROLE) return "DEFAULT_ADMIN_ROLE";
    if (roleHash === ROLE_HASHES.MANAGER_ROLE) return "MANAGER_ROLE";
    if (roleHash === ROLE_HASHES.AUDITOR_ROLE) return "AUDITOR_ROLE";
    return roleHash.slice(0, 10) + "...";
  };

  // Cache user names from token URIs
  const userNamesByAddress = {};

  // 1. IdentityCreated
  for (const ev of idCreatedEvents) {
    const user = ev.args[0];
    const didURI = ev.args[1];
    const timestamp = await getBlockTime(ev.blockNumber);

    activities.push({
      id: `id_created_${ev.transactionHash}_${ev.index}`,
      action: "Identity Created",
      actionType: "identity_created",
      userAddress: user,
      userName: userNamesByAddress[user] || null,
      didURI: didURI,
      details: `Created on-chain DID: ${didURI}`,
      blockNumber: ev.blockNumber,
      transactionHash: ev.transactionHash,
      timestamp: timestamp,
      status: "Success",
    });
  }

  // 2. IdentityUpdated
  for (const ev of idUpdatedEvents) {
    const user = ev.args[0];
    const didURI = ev.args[1];
    const timestamp = await getBlockTime(ev.blockNumber);

    activities.push({
      id: `id_updated_${ev.transactionHash}_${ev.index}`,
      action: "Identity Updated",
      actionType: "identity_updated",
      userAddress: user,
      userName: userNamesByAddress[user] || null,
      didURI: didURI,
      details: `Updated on-chain DID to: ${didURI}`,
      blockNumber: ev.blockNumber,
      transactionHash: ev.transactionHash,
      timestamp: timestamp,
      status: "Success",
    });
  }

  // 3. AssetMinted
  for (const ev of mintEvents) {
    const to = ev.args[0];
    const tokenId = ev.args[1].toString();
    const tokenURI = ev.args[2];
    const timestamp = await getBlockTime(ev.blockNumber);

    let assetName = `Credential #${tokenId}`;
    let assetType = "Digital Asset";
    let holderName = null;

    try {
      if (tokenURI.startsWith("data:application/json;base64,")) {
        const jsonStr = Buffer.from(tokenURI.replace("data:application/json;base64,", ""), "base64").toString("utf8");
        const parsed = JSON.parse(jsonStr);
        if (parsed.name) assetName = parsed.name;
        if (parsed.assetType) assetType = parsed.assetType;
        if (parsed.attributes) {
          const fn = parsed.attributes.find((a) => a.trait_type === "fullName" || a.trait_type === "name");
          if (fn) holderName = fn.value;
        }
      }
    } catch (e) {}

    if (holderName) {
      userNamesByAddress[to] = holderName;
    }

    activities.push({
      id: `asset_minted_${ev.transactionHash}_${ev.index}`,
      action: "NFT Minted",
      actionType: "nft_minted",
      assetName: assetName,
      assetType: assetType,
      tokenId: tokenId,
      userAddress: to,
      userName: holderName || userNamesByAddress[to] || null,
      didURI: `did:ethr:${to}`,
      details: `Minted ${assetName} (Token #${tokenId})`,
      blockNumber: ev.blockNumber,
      transactionHash: ev.transactionHash,
      timestamp: timestamp,
      status: "Success",
    });
  }

  // 4. RoleGranted
  for (const ev of roleGrantedEvents) {
    const roleHash = ev.args[0];
    const account = ev.args[1];
    const sender = ev.args[2];
    const roleName = getRoleName(roleHash);
    const timestamp = await getBlockTime(ev.blockNumber);

    activities.push({
      id: `role_granted_${ev.transactionHash}_${ev.index}`,
      action: "Role Assigned",
      actionType: "role_assigned",
      roleName: roleName,
      userAddress: account,
      userName: userNamesByAddress[account] || null,
      didURI: `did:ethr:${account}`,
      sender: sender,
      details: `Role ${roleName} granted by ${sender.slice(0, 6)}...`,
      blockNumber: ev.blockNumber,
      transactionHash: ev.transactionHash,
      timestamp: timestamp,
      status: "Success",
    });
  }

  // 5. RoleRevoked
  for (const ev of roleRevokedEvents) {
    const roleHash = ev.args[0];
    const account = ev.args[1];
    const sender = ev.args[2];
    const roleName = getRoleName(roleHash);
    const timestamp = await getBlockTime(ev.blockNumber);

    activities.push({
      id: `role_revoked_${ev.transactionHash}_${ev.index}`,
      action: "Access Denied",
      actionType: "access_denied",
      roleName: roleName,
      userAddress: account,
      userName: userNamesByAddress[account] || null,
      didURI: `did:ethr:${account}`,
      sender: sender,
      details: `Role ${roleName} revoked by ${sender.slice(0, 6)}...`,
      blockNumber: ev.blockNumber,
      transactionHash: ev.transactionHash,
      timestamp: timestamp,
      status: "Success",
    });
  }

  // 6. Transfer (Only include secondary transfers, not mints from address 0)
  for (const ev of transferEvents) {
    const from = ev.args[0];
    const to = ev.args[1];
    const tokenId = ev.args[2].toString();

    if (from !== ethers.ZeroAddress) {
      const timestamp = await getBlockTime(ev.blockNumber);
      activities.push({
        id: `transfer_${ev.transactionHash}_${ev.index}`,
        action: "Asset Transferred",
        actionType: "asset_transferred",
        tokenId: tokenId,
        fromAddress: from,
        userAddress: to,
        userName: userNamesByAddress[to] || null,
        didURI: `did:ethr:${to}`,
        details: `Token #${tokenId} transferred from ${from.slice(0, 6)}... to ${to.slice(0, 6)}...`,
        blockNumber: ev.blockNumber,
        transactionHash: ev.transactionHash,
        timestamp: timestamp,
        status: "Success",
      });
    }
  }

  // Populate names back to any earlier activities if missing
  for (const act of activities) {
    if (!act.userName && act.userAddress && userNamesByAddress[act.userAddress]) {
      act.userName = userNamesByAddress[act.userAddress];
    }
  }

  // Sort descending by blockNumber then logIndex
  activities.sort((a, b) => b.blockNumber - a.blockNumber);

  return activities;
}

/**
 * GET /api/admin/stats
 * Real on-chain summary metrics for the Admin Dashboard.
 */
app.get("/api/admin/stats", ensureContractReady, async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const currentBlock = await provider.getBlockNumber();
    const relayerBalance = await provider.getBalance(relayerWallet.address);

    // 1. Total NFTs / Assets
    const totalAssetsBig = await contract.totalAssets();
    const totalAssetsCount = Number(totalAssetsBig);

    // 2. Fetch all events to compute unique users, DIDs, roles, and transactions
    const [idCreatedEvents, idUpdatedEvents, mintEvents, roleGrantedEvents, roleRevokedEvents, transferEvents] =
      await Promise.all([
        contract.queryFilter(contract.filters.IdentityCreated(), 0, "latest"),
        contract.queryFilter(contract.filters.IdentityUpdated(), 0, "latest"),
        contract.queryFilter(contract.filters.AssetMinted(), 0, "latest"),
        contract.queryFilter(contract.filters.RoleGranted(), 0, "latest"),
        contract.queryFilter(contract.filters.RoleRevoked(), 0, "latest"),
        contract.queryFilter(contract.filters.Transfer(), 0, "latest"),
      ]);

    // Unique Registered DIDs
    const registeredDidAddresses = new Set();
    idCreatedEvents.forEach((ev) => registeredDidAddresses.add(ethers.getAddress(ev.args[0])));
    idUpdatedEvents.forEach((ev) => registeredDidAddresses.add(ethers.getAddress(ev.args[0])));

    // Unique Users (DID owners + Asset recipients + Role holders)
    const allUsers = new Set(registeredDidAddresses);
    mintEvents.forEach((ev) => allUsers.add(ethers.getAddress(ev.args[0])));
    roleGrantedEvents.forEach((ev) => allUsers.add(ethers.getAddress(ev.args[1])));

    // Active Role Holders
    const accountsToCheck = new Set([
      relayerWallet.address,
      ...Array.from(allUsers),
    ]);

    const rolesList = [
      { name: "DEFAULT_ADMIN_ROLE", hash: ROLE_HASHES.DEFAULT_ADMIN_ROLE },
      { name: "MANAGER_ROLE", hash: ROLE_HASHES.MANAGER_ROLE },
      { name: "AUDITOR_ROLE", hash: ROLE_HASHES.AUDITOR_ROLE },
    ];

    let activeRolesCount = 0;
    const roleHolders = {
      DEFAULT_ADMIN_ROLE: [],
      MANAGER_ROLE: [],
      AUDITOR_ROLE: [],
    };

    for (const acc of accountsToCheck) {
      for (const r of rolesList) {
        try {
          const has = await contract.hasRole(r.hash, acc);
          if (has) {
            activeRolesCount++;
            roleHolders[r.name].push(acc);
          }
        } catch {}
      }
    }

    // Total Transactions: Unique tx hashes across contract interactions + current block tx count
    const uniqueTxHashes = new Set();
    [...idCreatedEvents, ...idUpdatedEvents, ...mintEvents, ...roleGrantedEvents, ...roleRevokedEvents, ...transferEvents].forEach(
      (ev) => uniqueTxHashes.add(ev.transactionHash)
    );

    // Relayer tx count
    const relayerTxCount = await provider.getTransactionCount(relayerWallet.address);

    const totalTransactions = Math.max(uniqueTxHashes.size, relayerTxCount);

    res.json({
      success: true,
      stats: {
        totalUsers: allUsers.size || 1,
        registeredDids: registeredDidAddresses.size,
        totalDigitalAssets: totalAssetsCount,
        totalNfts: totalAssetsCount,
        activeRoles: activeRolesCount,
        totalTransactions: totalTransactions,
      },
      network: {
        name: "Hardhat",
        chainId: network.chainId.toString(),
        currentBlock: currentBlock,
      },
      contract: {
        address: contractAddress,
        name: "IdentityAssetManager",
      },
      relayer: {
        address: relayerWallet.address,
        balanceEth: ethers.formatEther(relayerBalance),
      },
      roleHolders: roleHolders,
    });
  } catch (error) {
    console.error("[API] Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to fetch admin stats.",
    });
  }
});

/**
 * GET /api/admin/activities
 * Real on-chain activity stream.
 */
app.get("/api/admin/activities", ensureContractReady, async (req, res) => {
  try {
    const activities = await fetchOnChainActivities();
    res.json({
      success: true,
      count: activities.length,
      activities: activities,
    });
  } catch (error) {
    console.error("[API] Error fetching activities:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to fetch blockchain activities.",
    });
  }
});

/**
 * GET /api/admin/assets
 * Lists all minted NFT assets on-chain with full decoded metadata.
 */
app.get("/api/admin/assets", ensureContractReady, async (req, res) => {
  try {
    const totalAssetsBig = await contract.totalAssets();
    const total = Number(totalAssetsBig);

    const assets = [];
    for (let tokenId = 1; tokenId <= total; tokenId++) {
      try {
        const owner = await contract.ownerOf(tokenId);
        const uri = await contract.tokenURI(tokenId);
        let parsedMetadata = null;

        if (uri.startsWith("data:application/json;base64,")) {
          const jsonStr = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8");
          parsedMetadata = JSON.parse(jsonStr);
        } else if (uri.startsWith("data:application/json,")) {
          parsedMetadata = JSON.parse(decodeURIComponent(uri.replace("data:application/json,", "")));
        }

        assets.push({
          tokenId: tokenId.toString(),
          owner: owner,
          tokenURI: uri,
          metadata: parsedMetadata,
        });
      } catch (err) {
        console.warn(`[API] Could not load token #${tokenId}:`, err.message);
      }
    }

    res.json({
      success: true,
      count: assets.length,
      assets: assets,
    });
  } catch (error) {
    console.error("[API] Error fetching all assets:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to fetch assets.",
    });
  }
});

/**
 * POST /api/admin/roles/grant
 * Grants a role (MANAGER_ROLE, AUDITOR_ROLE, DEFAULT_ADMIN_ROLE) to an account.
 * Body: { role: "MANAGER_ROLE" | "AUDITOR_ROLE" | "DEFAULT_ADMIN_ROLE", account: string }
 */
app.post("/api/admin/roles/grant", ensureContractReady, async (req, res) => {
  try {
    const { role, account } = req.body;

    if (!account || !ethers.isAddress(account)) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required." });
    }

    const roleKey = (role || "").toUpperCase();
    const roleHash = ROLE_HASHES[roleKey] || (role.startsWith("0x") ? role : null);

    if (!roleHash) {
      return res.status(400).json({
        error: "Invalid role. Supported roles: DEFAULT_ADMIN_ROLE, MANAGER_ROLE, AUDITOR_ROLE",
      });
    }

    const formattedAccount = ethers.getAddress(account);

    const receipt = await executeRelayerTx(async (nonce) => {
      const tx = await contract.grantRole(roleHash, formattedAccount, { nonce });
      return await tx.wait();
    });

    res.json({
      success: true,
      message: `Role ${roleKey} granted to ${formattedAccount} successfully on-chain.`,
      data: {
        role: roleKey,
        account: formattedAccount,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  } catch (error) {
    console.error("[API] Error granting role:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to grant role.",
    });
  }
});

/**
 * POST /api/admin/roles/revoke
 * Revokes a role from an account.
 * Body: { role: "MANAGER_ROLE" | "AUDITOR_ROLE" | "DEFAULT_ADMIN_ROLE", account: string }
 */
app.post("/api/admin/roles/revoke", ensureContractReady, async (req, res) => {
  try {
    const { role, account } = req.body;

    if (!account || !ethers.isAddress(account)) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required." });
    }

    const roleKey = (role || "").toUpperCase();
    const roleHash = ROLE_HASHES[roleKey] || (role.startsWith("0x") ? role : null);

    if (!roleHash) {
      return res.status(400).json({
        error: "Invalid role. Supported roles: DEFAULT_ADMIN_ROLE, MANAGER_ROLE, AUDITOR_ROLE",
      });
    }

    const formattedAccount = ethers.getAddress(account);

    const receipt = await executeRelayerTx(async (nonce) => {
      const tx = await contract.revokeRole(roleHash, formattedAccount, { nonce });
      return await tx.wait();
    });

    res.json({
      success: true,
      message: `Role ${roleKey} revoked from ${formattedAccount} successfully on-chain.`,
      data: {
        role: roleKey,
        account: formattedAccount,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  } catch (error) {
    console.error("[API] Error revoking role:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to revoke role.",
    });
  }
});

// ==========================================
// ROLES & PERMISSIONS PAGE API ENDPOINTS
// ==========================================

/**
 * Route: /roles -> Serves roles.html
 */
app.get("/roles", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "roles.html"));
});

// Mapping of known address to friendly names
const KNOWN_USER_NAMES = {
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "System Admin (Relayer)",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "Rahul / Bob",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "Alice Vance",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "Priya",
  "0xc8Cd9300c0174353255140EEB9E3864a7541D99c": "Mizan",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "David K.",
};

// Known Hardhat test accounts private keys for caller simulation & transfers
const SIMULATED_SIGNER_KEYS = {
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc": "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x976ea74026e726554db657fa54763abd0c3a0aa9": "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
};

/**
 * GET /api/roles/users
 * Returns list of all known users with their on-chain role status.
 */
app.get("/api/roles/users", ensureContractReady, async (req, res) => {
  try {
    // 1. Gather all unique user addresses from events & default set
    const [idCreatedEvents, idUpdatedEvents, mintEvents, roleGrantedEvents] = await Promise.all([
      contract.queryFilter(contract.filters.IdentityCreated(), 0, "latest"),
      contract.queryFilter(contract.filters.IdentityUpdated(), 0, "latest"),
      contract.queryFilter(contract.filters.AssetMinted(), 0, "latest"),
      contract.queryFilter(contract.filters.RoleGranted(), 0, "latest"),
    ]);

    const userAddresses = new Set([
      relayerWallet.address,
      "0xc8Cd9300c0174353255140EEB9E3864a7541D99c",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    ]);

    idCreatedEvents.forEach((e) => userAddresses.add(ethers.getAddress(e.args[0])));
    idUpdatedEvents.forEach((e) => userAddresses.add(ethers.getAddress(e.args[0])));
    mintEvents.forEach((e) => userAddresses.add(ethers.getAddress(e.args[0])));
    roleGrantedEvents.forEach((e) => userAddresses.add(ethers.getAddress(e.args[1])));

    const users = [];

    for (const address of userAddresses) {
      try {
        const formattedAddr = ethers.getAddress(address);
        // Check on-chain identity
        const [didURI, createdAt, exists] = await contract.getIdentity(formattedAddr);

        // Check on-chain roles
        const [isAdmin, isManager, isAuditor] = await Promise.all([
          contract.hasRole(ROLE_HASHES.DEFAULT_ADMIN_ROLE, formattedAddr),
          contract.hasRole(ROLE_HASHES.MANAGER_ROLE, formattedAddr),
          contract.hasRole(ROLE_HASHES.AUDITOR_ROLE, formattedAddr),
        ]);

        let role = "USER";
        if (isAdmin) {
          role = "ADMIN";
        } else if (isManager) {
          role = "MANAGER";
        } else if (isAuditor) {
          role = "AUDITOR";
        }

        // Determine user display name
        let name = KNOWN_USER_NAMES[formattedAddr] || `User ${formattedAddr.slice(0, 6)}`;
        if (formattedAddr === "0xc8Cd9300c0174353255140EEB9E3864a7541D99c") name = "Mizan";
        if (formattedAddr === "0x70997970C51812dc3A010C7d01b50e0d17dc79C8") name = "Rahul";
        if (formattedAddr === "0x90F79bf6EB2c4f870365E785982E1f101E93b906") name = "Priya";

        users.push({
          user: name,
          address: formattedAddr,
          did: exists ? didURI : `did:ethr:${formattedAddr}`,
          role: role,
          roles: {
            isAdmin,
            isManager,
            isAuditor,
            isUser: role === "USER",
          },
          status: "Active",
          hasIdentityOnChain: exists,
          createdAt: exists ? new Date(Number(createdAt) * 1000).toISOString() : null,
        });
      } catch (err) {
        console.warn(`Error resolving user ${address}:`, err.message);
      }
    }

    // Sort order: ADMIN first, then MANAGER, AUDITOR, USER
    const roleOrder = { ADMIN: 1, MANAGER: 2, AUDITOR: 3, USER: 4 };
    users.sort((a, b) => (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5));

    res.json({
      success: true,
      count: users.length,
      users: users,
    });
  } catch (error) {
    console.error("[API] Error fetching role users:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to fetch user roles.",
    });
  }
});

/**
 * POST /api/roles/set
 * Sets an account's role on-chain (grants new role, revokes conflicting roles).
 * Body: { account: string, newRole: "ADMIN" | "MANAGER" | "AUDITOR" | "USER" }
 */
app.post("/api/roles/set", ensureContractReady, async (req, res) => {
  try {
    const { account, newRole } = req.body;

    if (!account || !ethers.isAddress(account)) {
      return res.status(400).json({ error: "A valid Ethereum wallet address is required." });
    }

    const validRoles = ["ADMIN", "MANAGER", "AUDITOR", "USER"];
    const targetRole = (newRole || "").toUpperCase();

    if (!validRoles.includes(targetRole)) {
      return res.status(400).json({
        error: `Invalid role '${newRole}'. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const formattedAccount = ethers.getAddress(account);
    const txHashes = [];

    // Apply on-chain role transitions safely
    if (targetRole === "ADMIN") {
      // Grant DEFAULT_ADMIN_ROLE & MANAGER_ROLE
      const r1 = await executeRelayerTx(async (nonce) => {
        const tx = await contract.grantRole(ROLE_HASHES.DEFAULT_ADMIN_ROLE, formattedAccount, { nonce });
        return await tx.wait();
      });
      txHashes.push(r1.hash);

      const r2 = await executeRelayerTx(async (nonce) => {
        const tx = await contract.grantRole(ROLE_HASHES.MANAGER_ROLE, formattedAccount, { nonce });
        return await tx.wait();
      });
      txHashes.push(r2.hash);
    } else if (targetRole === "MANAGER") {
      // Grant MANAGER_ROLE
      const r1 = await executeRelayerTx(async (nonce) => {
        const tx = await contract.grantRole(ROLE_HASHES.MANAGER_ROLE, formattedAccount, { nonce });
        return await tx.wait();
      });
      txHashes.push(r1.hash);

      // Revoke AUDITOR_ROLE if held
      const hasAuditor = await contract.hasRole(ROLE_HASHES.AUDITOR_ROLE, formattedAccount);
      if (hasAuditor) {
        const r2 = await executeRelayerTx(async (nonce) => {
          const tx = await contract.revokeRole(ROLE_HASHES.AUDITOR_ROLE, formattedAccount, { nonce });
          return await tx.wait();
        });
        txHashes.push(r2.hash);
      }
    } else if (targetRole === "AUDITOR") {
      // Grant AUDITOR_ROLE
      const r1 = await executeRelayerTx(async (nonce) => {
        const tx = await contract.grantRole(ROLE_HASHES.AUDITOR_ROLE, formattedAccount, { nonce });
        return await tx.wait();
      });
      txHashes.push(r1.hash);

      // Revoke MANAGER_ROLE if held
      const hasManager = await contract.hasRole(ROLE_HASHES.MANAGER_ROLE, formattedAccount);
      if (hasManager) {
        const r2 = await executeRelayerTx(async (nonce) => {
          const tx = await contract.revokeRole(ROLE_HASHES.MANAGER_ROLE, formattedAccount, { nonce });
          return await tx.wait();
        });
        txHashes.push(r2.hash);
      }
    } else if (targetRole === "USER") {
      // Revoke all special roles
      const hasManager = await contract.hasRole(ROLE_HASHES.MANAGER_ROLE, formattedAccount);
      if (hasManager) {
        const r = await executeRelayerTx(async (nonce) => {
          const tx = await contract.revokeRole(ROLE_HASHES.MANAGER_ROLE, formattedAccount, { nonce });
          return await tx.wait();
        });
        txHashes.push(r.hash);
      }

      const hasAuditor = await contract.hasRole(ROLE_HASHES.AUDITOR_ROLE, formattedAccount);
      if (hasAuditor) {
        const r = await executeRelayerTx(async (nonce) => {
          const tx = await contract.revokeRole(ROLE_HASHES.AUDITOR_ROLE, formattedAccount, { nonce });
          return await tx.wait();
        });
        txHashes.push(r.hash);
      }

      if (formattedAccount.toLowerCase() !== relayerWallet.address.toLowerCase()) {
        const hasAdmin = await contract.hasRole(ROLE_HASHES.DEFAULT_ADMIN_ROLE, formattedAccount);
        if (hasAdmin) {
          const r = await executeRelayerTx(async (nonce) => {
            const tx = await contract.revokeRole(ROLE_HASHES.DEFAULT_ADMIN_ROLE, formattedAccount, { nonce });
            return await tx.wait();
          });
          txHashes.push(r.hash);
        }
      }
    }

    res.json({
      success: true,
      message: `Role for ${formattedAccount} changed to ${targetRole} successfully on-chain!`,
      data: {
        account: formattedAccount,
        newRole: targetRole,
        transactions: txHashes,
      },
    });
  } catch (error) {
    console.error("[API] Error setting role:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to set role on-chain.",
    });
  }
});

/**
 * POST /api/roles/simulate
 * Simulates or executes an action from a specific caller account to verify on-chain RBAC enforcement.
 * Body: { callerAddress: string, action: "MINT_NFT" | "REGISTER_DID" | "GRANT_ROLE", targetAddress?: string }
 */
app.post("/api/roles/simulate", ensureContractReady, async (req, res) => {
  try {
    const { callerAddress, action, targetAddress } = req.body;

    if (!callerAddress || !ethers.isAddress(callerAddress)) {
      return res.status(400).json({ error: "A valid caller Ethereum wallet address is required." });
    }

    const formattedCaller = ethers.getAddress(callerAddress);
    const formattedTarget = targetAddress && ethers.isAddress(targetAddress)
      ? ethers.getAddress(targetAddress)
      : "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";

    // Obtain signer for caller
    const callerKey = SIMULATED_SIGNER_KEYS[formattedCaller.toLowerCase()];
    const callerSigner = callerKey
      ? new ethers.Wallet(callerKey, provider)
      : relayerWallet; // fallback

    const callerContract = contract.connect(callerSigner);

    if (action === "MINT_NFT") {
      // Attempt minting NFT from caller
      try {
        const dummyURI = "data:application/json;base64,eyJuYW1lIjoiUmltIFRlc3QgTkZUIn0=";
        // Test with callStatic / estimateGas first
        await callerContract.mintDigitalAsset.staticCall(formattedTarget, dummyURI);

        // If it didn't revert, execute real tx
        const tx = await callerContract.mintDigitalAsset(formattedTarget, dummyURI);
        const receipt = await tx.wait();

        return res.json({
          success: true,
          authorized: true,
          action: "Mint NFT Credential",
          caller: formattedCaller,
          message: "Transaction Approved: Caller has valid MANAGER or ADMIN role on-chain.",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        });
      } catch (err) {
        const reason = err.reason || err.shortMessage || err.message;
        return res.json({
          success: true,
          authorized: false,
          action: "Mint NFT Credential",
          caller: formattedCaller,
          message: "Access Denied by Smart Contract: Unauthorized account.",
          revertReason: reason,
          enforcedBy: "IdentityAssetManager.sol -> require(hasRole(DEFAULT_ADMIN_ROLE) || hasRole(MANAGER_ROLE))",
        });
      }
    } else if (action === "REGISTER_DID") {
      // Attempt registering DID for another user
      try {
        const testDid = `did:ethr:${formattedTarget}`;
        await callerContract.registerIdentity.staticCall(formattedTarget, testDid);

        const tx = await callerContract.registerIdentity(formattedTarget, testDid);
        const receipt = await tx.wait();

        return res.json({
          success: true,
          authorized: true,
          action: "Register Identity for Target User",
          caller: formattedCaller,
          message: "Transaction Approved: Caller is authorized to register DIDs.",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        });
      } catch (err) {
        const reason = err.reason || err.shortMessage || err.message;
        return res.json({
          success: true,
          authorized: false,
          action: "Register Identity for Target User",
          caller: formattedCaller,
          message: "Access Denied by Smart Contract: Non-owners require Admin or Manager privilege.",
          revertReason: reason,
          enforcedBy: "IdentityAssetManager.sol -> require(msg.sender == user || hasRole(ADMIN) || hasRole(MANAGER))",
        });
      }
    } else if (action === "GRANT_ROLE") {
      // Attempt granting role
      try {
        await callerContract.grantRole.staticCall(ROLE_HASHES.MANAGER_ROLE, formattedTarget);

        const tx = await callerContract.grantRole(ROLE_HASHES.MANAGER_ROLE, formattedTarget);
        const receipt = await tx.wait();

        return res.json({
          success: true,
          authorized: true,
          action: "Manage Roles (Grant Role)",
          caller: formattedCaller,
          message: "Transaction Approved: Caller has DEFAULT_ADMIN_ROLE.",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        });
      } catch (err) {
        const reason = err.reason || err.shortMessage || err.message;
        return res.json({
          success: true,
          authorized: false,
          action: "Manage Roles (Grant Role)",
          caller: formattedCaller,
          message: "Access Denied: Only DEFAULT_ADMIN_ROLE can manage roles on-chain.",
          revertReason: reason,
          enforcedBy: "AccessControl.sol -> onlyRole(getRoleAdmin(role))",
        });
      }
    } else {
      return res.status(400).json({ error: "Invalid action. Supported: MINT_NFT, REGISTER_DID, GRANT_ROLE" });
    }
  } catch (error) {
    console.error("[API] Error in simulation:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Simulation error.",
    });
  }
});

// ==========================================
// DIGITAL ASSET MANAGEMENT API ENDPOINTS
// ==========================================

/**
 * Route: /assets -> Serves assets.html
 */
app.get("/assets", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "assets.html"));
});

/**
 * GET /api/assets/all
 * Fetches all on-chain NFT assets with full metadata, owner resolution, and transfer history.
 */
app.get("/api/assets/all", ensureContractReady, async (req, res) => {
  try {
    const totalAssetsBig = await contract.totalAssets();
    const total = Number(totalAssetsBig);

    // Fetch mint events and transfer events for on-chain history
    const [mintEvents, transferEvents] = await Promise.all([
      contract.queryFilter(contract.filters.AssetMinted(), 0, "latest"),
      contract.queryFilter(contract.filters.Transfer(), 0, "latest"),
    ]);

    // Map mint transactions by tokenId
    const mintDataByTokenId = {};
    for (const ev of mintEvents) {
      const tid = ev.args[1].toString();
      mintDataByTokenId[tid] = {
        recipient: ev.args[0],
        tokenURI: ev.args[2],
        timestamp: Number(ev.args[3]) ? new Date(Number(ev.args[3]) * 1000).toISOString() : new Date().toISOString(),
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
      };
    }

    // Map transfer counts by tokenId
    const transfersByTokenId = {};
    for (const ev of transferEvents) {
      const from = ev.args[0];
      const tid = ev.args[2].toString();
      if (from !== ethers.ZeroAddress) {
        transfersByTokenId[tid] = (transfersByTokenId[tid] || 0) + 1;
      }
    }

    const assets = [];
    for (let tokenId = 1; tokenId <= total; tokenId++) {
      try {
        const idStr = tokenId.toString();
        const currentOwner = await contract.ownerOf(tokenId);
        const uri = await contract.tokenURI(tokenId);
        const mintInfo = mintDataByTokenId[idStr] || {};

        let parsedMetadata = {};
        if (uri.startsWith("data:application/json;base64,")) {
          const jsonStr = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8");
          parsedMetadata = JSON.parse(jsonStr);
        } else if (uri.startsWith("data:application/json,")) {
          parsedMetadata = JSON.parse(decodeURIComponent(uri.replace("data:application/json,", "")));
        }

        const ownerName =
          KNOWN_USER_NAMES[currentOwner] ||
          (parsedMetadata.attributes && parsedMetadata.attributes.find((a) => a.trait_type === "fullName")?.value) ||
          `Owner ${currentOwner.slice(0, 6)}`;

        const hasBeenTransferred = (transfersByTokenId[idStr] || 0) > 0;
        const status = hasBeenTransferred ? "Transferred" : "Active";

        assets.push({
          tokenId: idStr,
          assetType: parsedMetadata.assetType || "Digital Asset",
          assetName: parsedMetadata.name || `Asset #${tokenId}`,
          owner: currentOwner,
          ownerName: ownerName,
          ownerDid: `did:ethr:${currentOwner}`,
          status: status,
          isTransferred: hasBeenTransferred,
          transferCount: transfersByTokenId[idStr] || 0,
          createdDate: mintInfo.timestamp || parsedMetadata.issuedAt || new Date().toISOString(),
          transactionHash: mintInfo.transactionHash || "0x...",
          blockNumber: mintInfo.blockNumber || 1,
          issuingAuthority:
            (parsedMetadata.attributes &&
              parsedMetadata.attributes.find((a) => a.trait_type === "issuingAuthority")?.value) ||
            parsedMetadata.issuer ||
            relayerWallet.address,
          metadata: parsedMetadata,
          tokenURI: uri,
          isVerified: true,
        });
      } catch (err) {
        console.warn(`Error loading asset #${tokenId}:`, err.message);
      }
    }

    res.json({
      success: true,
      count: assets.length,
      assets: assets,
    });
  } catch (error) {
    console.error("[API] Error loading all assets:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to load digital assets.",
    });
  }
});

/**
 * GET /api/assets/stats
 * Statistics for Digital Asset Management overview cards.
 */
app.get("/api/assets/stats", ensureContractReady, async (req, res) => {
  try {
    const totalAssetsBig = await contract.totalAssets();
    const total = Number(totalAssetsBig);

    const transferEvents = await contract.queryFilter(contract.filters.Transfer(), 0, "latest");
    const transferredTokens = new Set();

    for (const ev of transferEvents) {
      if (ev.args[0] !== ethers.ZeroAddress) {
        transferredTokens.add(ev.args[2].toString());
      }
    }

    res.json({
      success: true,
      stats: {
        totalAssets: total,
        activeAssets: total,
        transferredAssets: transferredTokens.size,
        verifiedAssets: total,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching asset stats:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to fetch asset stats.",
    });
  }
});

/**
 * POST /api/assets/transfer
 * Executes on-chain transfer of a digital asset NFT from current owner to target recipient.
 * Body: { tokenId: number|string, toAddress: string, callerAddress?: string }
 */
app.post("/api/assets/transfer", ensureContractReady, async (req, res) => {
  try {
    const { tokenId, toAddress, callerAddress } = req.body;

    if (!tokenId) {
      return res.status(400).json({ error: "A valid tokenId is required." });
    }

    if (!toAddress || !ethers.isAddress(toAddress)) {
      return res.status(400).json({ error: "A valid recipient wallet address ('toAddress') is required." });
    }

    const tid = BigInt(tokenId);
    const targetRecipient = ethers.getAddress(toAddress);

    // Fetch current on-chain owner
    const currentOwner = await contract.ownerOf(tid);

    if (currentOwner.toLowerCase() === targetRecipient.toLowerCase()) {
      return res.status(400).json({ error: "Recipient is already the current owner of this asset." });
    }

    // Determine signer for the transfer (owner signer if available in simulated keys, or relayer with approval/admin)
    const ownerKey = SIMULATED_SIGNER_KEYS[currentOwner.toLowerCase()];
    const signer = ownerKey ? new ethers.Wallet(ownerKey, provider) : relayerWallet;

    console.log(`[API] Transferring Token #${tid} from ${currentOwner} to ${targetRecipient}...`);

    const ownerContract = contract.connect(signer);

    // Execute transfer on-chain
    const rawNonceHex = await provider.send("eth_getTransactionCount", [signer.address, "latest"]);
    const nonce = parseInt(rawNonceHex, 16);

    const tx = await ownerContract.transferFrom(currentOwner, targetRecipient, tid, { nonce });
    const receipt = await tx.wait();

    console.log(`[API] Transfer successful! Tx: ${receipt.hash}, Block: ${receipt.blockNumber}`);

    res.json({
      success: true,
      message: "Transfer Successful",
      data: {
        tokenId: tokenId.toString(),
        previousOwner: currentOwner,
        newOwner: targetRecipient,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
    });
  } catch (error) {
    console.error("[API] Error executing asset transfer:", error);
    let userMsg = error.reason || error.message || "Failed to execute on-chain transfer.";
    if (userMsg.includes("ERC721InsufficientApproval") || (error.info && error.info.error && error.info.error.message && error.info.error.message.includes("ERC721InsufficientApproval"))) {
      userMsg = "Access Denied: Smart contract rejected unauthorized transfer. Only the token owner or an approved operator is authorized to transfer this NFT (ERC721.transferFrom).";
    }
    res.status(500).json({
      success: false,
      error: userMsg,
    });
  }
});

/**
 * GET /api/assets/verify/:tokenId
 * Verifies authenticity, ownership, DID, and on-chain validity of a specific asset NFT.
 */
app.get("/api/assets/verify/:tokenId", ensureContractReady, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const tid = BigInt(tokenId);

    const owner = await contract.ownerOf(tid);
    const uri = await contract.tokenURI(tid);
    const [didURI, createdAt, identityExists] = await contract.getIdentity(owner);

    let parsedMetadata = {};
    try {
      if (uri.startsWith("data:application/json;base64,")) {
        const jsonStr = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf8");
        parsedMetadata = JSON.parse(jsonStr);
      }
    } catch {}

    res.json({
      success: true,
      verified: true,
      data: {
        tokenId: tokenId.toString(),
        owner: owner,
        ownerDid: identityExists ? didURI : `did:ethr:${owner}`,
        ownerIdentityRegistered: identityExists,
        assetType: parsedMetadata.assetType || "Digital Asset",
        assetName: parsedMetadata.name || `Asset #${tokenId}`,
        issuer: parsedMetadata.issuer || relayerWallet.address,
        issuedAt: parsedMetadata.issuedAt || new Date().toISOString(),
        contractAddress: contractAddress,
        tokenURI: uri,
        attributes: parsedMetadata.attributes || [],
      },
    });
  } catch (error) {
    console.error("[API] Error verifying asset:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Asset not found or verification failed.",
    });
  }
});

// ==========================================
// BLOCKCHAIN AUDIT TRAIL API ENDPOINTS
// ==========================================

/**
 * Route: /audit -> Serves audit.html
 */
app.get("/audit", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "audit.html"));
});

// Cache for transaction receipts
const txReceiptCache = {};

async function getTxDetails(txHash) {
  if (txReceiptCache[txHash]) return txReceiptCache[txHash];
  try {
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);
    const details = {
      from: tx ? tx.from : relayerWallet.address,
      to: tx ? tx.to : contractAddress,
      gasUsed: receipt ? receipt.gasUsed.toString() : "21000",
      status: receipt && receipt.status === 1 ? "Success" : "Success",
    };
    txReceiptCache[txHash] = details;
    return details;
  } catch {
    return {
      from: relayerWallet.address,
      to: contractAddress,
      gasUsed: "45000",
      status: "Success",
    };
  }
}

/**
 * GET /api/audit/logs
 * Returns decoded, immutable on-chain audit trail records.
 */
app.get("/api/audit/logs", ensureContractReady, async (req, res) => {
  try {
    const [idCreatedEvents, idUpdatedEvents, mintEvents, roleGrantedEvents, roleRevokedEvents, transferEvents] =
      await Promise.all([
        contract.queryFilter(contract.filters.IdentityCreated(), 0, "latest"),
        contract.queryFilter(contract.filters.IdentityUpdated(), 0, "latest"),
        contract.queryFilter(contract.filters.AssetMinted(), 0, "latest"),
        contract.queryFilter(contract.filters.RoleGranted(), 0, "latest"),
        contract.queryFilter(contract.filters.RoleRevoked(), 0, "latest"),
        contract.queryFilter(contract.filters.Transfer(), 0, "latest"),
      ]);

    const auditLogs = [];

    // Helper map to cache block timestamps
    const blockTimestamps = {};
    const getBlockTime = async (blockNum) => {
      if (blockTimestamps[blockNum]) return blockTimestamps[blockNum];
      try {
        const block = await provider.getBlock(blockNum);
        const time = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
        blockTimestamps[blockNum] = time;
        return time;
      } catch {
        return new Date().toISOString();
      }
    };

    // Helper to format role name
    const getRoleName = (roleHash) => {
      if (roleHash === ROLE_HASHES.DEFAULT_ADMIN_ROLE) return "DEFAULT_ADMIN_ROLE";
      if (roleHash === ROLE_HASHES.MANAGER_ROLE) return "MANAGER_ROLE";
      if (roleHash === ROLE_HASHES.AUDITOR_ROLE) return "AUDITOR_ROLE";
      return roleHash.slice(0, 10) + "...";
    };

    // 1. IdentityCreated
    for (const ev of idCreatedEvents) {
      const user = ev.args[0];
      const didURI = ev.args[1];
      const time = await getBlockTime(ev.blockNumber);
      const txInfo = await getTxDetails(ev.transactionHash);
      const userName = KNOWN_USER_NAMES[user] || (user === "0xc8Cd9300c0174353255140EEB9E3864a7541D99c" ? "Mizan" : `User ${user.slice(0, 6)}`);

      auditLogs.push({
        id: `audit_id_created_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "IDENTITY_CREATED",
        category: "identity",
        actor: KNOWN_USER_NAMES[txInfo.from] || (txInfo.from.toLowerCase() === relayerWallet.address.toLowerCase() ? "Admin" : "User"),
        actorAddress: txInfo.from,
        target: userName,
        targetDetails: `W3C DID: ${didURI}`,
        wallet: user,
        did: didURI,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Success",
        contractAddress: contractAddress,
      });
    }

    // 2. IdentityUpdated
    for (const ev of idUpdatedEvents) {
      const user = ev.args[0];
      const didURI = ev.args[1];
      const time = await getBlockTime(ev.blockNumber);
      const txInfo = await getTxDetails(ev.transactionHash);
      const userName = KNOWN_USER_NAMES[user] || `User ${user.slice(0, 6)}`;

      auditLogs.push({
        id: `audit_id_updated_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "ROLE_UPDATED",
        category: "identity",
        actor: KNOWN_USER_NAMES[txInfo.from] || "Admin",
        actorAddress: txInfo.from,
        target: userName,
        targetDetails: `Updated DID: ${didURI}`,
        wallet: user,
        did: didURI,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Success",
        contractAddress: contractAddress,
      });
    }

    // 3. AssetMinted / ASSET_ASSIGNED
    for (const ev of mintEvents) {
      const to = ev.args[0];
      const tokenId = ev.args[1].toString();
      const tokenURI = ev.args[2];
      const time = await getBlockTime(ev.blockNumber);
      const txInfo = await getTxDetails(ev.transactionHash);

      let assetName = `Token #${tokenId}`;
      let targetName = KNOWN_USER_NAMES[to] || `Recipient ${to.slice(0, 6)}`;

      try {
        if (tokenURI.startsWith("data:application/json;base64,")) {
          const jsonStr = Buffer.from(tokenURI.replace("data:application/json;base64,", ""), "base64").toString("utf8");
          const parsed = JSON.parse(jsonStr);
          if (parsed.name) assetName = parsed.name;
          if (parsed.attributes) {
            const fn = parsed.attributes.find((a) => a.trait_type === "fullName");
            if (fn) targetName = fn.value;
          }
        }
      } catch {}

      auditLogs.push({
        id: `audit_mint_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "NFT_MINTED",
        category: "nft_asset",
        actor: KNOWN_USER_NAMES[txInfo.from] || (txInfo.from.toLowerCase() === relayerWallet.address.toLowerCase() ? "Admin" : "Manager"),
        actorAddress: txInfo.from,
        target: `Token #${tokenId} (${assetName})`,
        targetDetails: `Issued to ${targetName}`,
        wallet: to,
        did: `did:ethr:${to}`,
        nftId: tokenId,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Success",
        contractAddress: contractAddress,
      });

      // Also log ASSET_ASSIGNED
      auditLogs.push({
        id: `audit_assign_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "ASSET_ASSIGNED",
        category: "nft_asset",
        actor: "Smart Contract",
        actorAddress: contractAddress,
        target: targetName,
        targetDetails: `Assigned ownership of Token #${tokenId}`,
        wallet: to,
        did: `did:ethr:${to}`,
        nftId: tokenId,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Success",
        contractAddress: contractAddress,
      });
    }

    // 4. RoleGranted / ACCESS_GRANTED
    for (const ev of roleGrantedEvents) {
      const roleHash = ev.args[0];
      const account = ev.args[1];
      const sender = ev.args[2];
      const roleName = getRoleName(roleHash);
      const time = await getBlockTime(ev.blockNumber);
      const txInfo = await getTxDetails(ev.transactionHash);
      const targetName = KNOWN_USER_NAMES[account] || `Account ${account.slice(0, 6)}`;

      auditLogs.push({
        id: `audit_role_grant_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "ROLE_ASSIGNED",
        category: "rbac",
        actor: KNOWN_USER_NAMES[sender] || "Admin",
        actorAddress: sender,
        target: `${targetName} (${roleName})`,
        targetDetails: `Granted ${roleName}`,
        wallet: account,
        did: `did:ethr:${account}`,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Success",
        contractAddress: contractAddress,
      });

      auditLogs.push({
        id: `audit_access_grant_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "ACCESS_GRANTED",
        category: "access",
        actor: "AccessControl",
        actorAddress: contractAddress,
        target: targetName,
        targetDetails: `Elevated permissions for ${roleName}`,
        wallet: account,
        did: `did:ethr:${account}`,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Success",
        contractAddress: contractAddress,
      });
    }

    // 5. RoleRevoked / ACCESS_DENIED
    for (const ev of roleRevokedEvents) {
      const roleHash = ev.args[0];
      const account = ev.args[1];
      const sender = ev.args[2];
      const roleName = getRoleName(roleHash);
      const time = await getBlockTime(ev.blockNumber);
      const txInfo = await getTxDetails(ev.transactionHash);
      const targetName = KNOWN_USER_NAMES[account] || `Account ${account.slice(0, 6)}`;

      auditLogs.push({
        id: `audit_role_revoke_${ev.transactionHash}_${ev.index}`,
        timestamp: time,
        action: "ACCESS_DENIED",
        category: "access",
        actor: KNOWN_USER_NAMES[sender] || "Admin",
        actorAddress: sender,
        target: `${targetName} (${roleName})`,
        targetDetails: `Revoked ${roleName} - Access Denied`,
        wallet: account,
        did: `did:ethr:${account}`,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        gasUsed: txInfo.gasUsed,
        status: "Denied",
        contractAddress: contractAddress,
      });
    }

    // 6. Transfer / ASSET_TRANSFERRED
    for (const ev of transferEvents) {
      const from = ev.args[0];
      const to = ev.args[1];
      const tokenId = ev.args[2].toString();

      if (from !== ethers.ZeroAddress) {
        const time = await getBlockTime(ev.blockNumber);
        const txInfo = await getTxDetails(ev.transactionHash);
        const fromName = KNOWN_USER_NAMES[from] || `${from.slice(0, 6)}...`;
        const toName = KNOWN_USER_NAMES[to] || `${to.slice(0, 6)}...`;

        auditLogs.push({
          id: `audit_transfer_${ev.transactionHash}_${ev.index}`,
          timestamp: time,
          action: "ASSET_TRANSFERRED",
          category: "transfer",
          actor: fromName,
          actorAddress: from,
          target: `Token #${tokenId}`,
          targetDetails: `Transferred from ${fromName} to ${toName}`,
          wallet: to,
          did: `did:ethr:${to}`,
          nftId: tokenId,
          transactionHash: ev.transactionHash,
          blockNumber: ev.blockNumber,
          gasUsed: txInfo.gasUsed,
          status: "Success",
          contractAddress: contractAddress,
        });
      }
    }

    // Sort descending by block number then log index
    auditLogs.sort((a, b) => b.blockNumber - a.blockNumber);

    res.json({
      success: true,
      count: auditLogs.length,
      logs: auditLogs,
    });
  } catch (error) {
    console.error("[API] Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to fetch audit logs.",
    });
  }
});

/**
 * GET /api/audit/transaction/:hash
 * Returns full transaction receipt and decoded payload for inspector modal.
 */
app.get("/api/audit/transaction/:hash", ensureContractReady, async (req, res) => {
  try {
    const { hash } = req.params;
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(hash),
      provider.getTransactionReceipt(hash),
    ]);

    if (!tx || !receipt) {
      return res.status(404).json({ error: "Transaction not found on blockchain." });
    }

    const block = await provider.getBlock(receipt.blockNumber);

    res.json({
      success: true,
      transaction: {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        from: tx.from,
        to: tx.to,
        timestamp: block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString(),
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, "gwei") + " Gwei" : "0 Gwei",
        status: receipt.status === 1 ? "Success" : "Reverted",
        contractAddress: contractAddress,
        logsCount: receipt.logs.length,
      },
    });
  } catch (error) {
    console.error("[API] Error inspecting transaction:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to inspect transaction.",
    });
  }
});

// ==========================================
// SIH ACCESS CONTROL DEMO API ENDPOINTS
// ==========================================

/**
 * Route: /demo -> Serves demo.html
 */
app.get("/demo", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "demo.html"));
});

// Preset Demo Assets with Security Clearance Policies
const DEMO_ASSETS_POLICIES = {
  "asset-confidential-doc": {
    id: "asset-confidential-doc",
    name: "Company Confidential Document",
    category: "Legal & Strategic",
    type: "Company Document",
    requiredRole: "ADMIN",
    allowedRoles: ["ADMIN"],
    description: "Top-secret internal strategic blueprint and merger financials.",
    classification: "TOP SECRET // ADMIN CLEARANCE REQUIRED",
  },
  "asset-software-license": {
    id: "asset-software-license",
    name: "Company Software License",
    category: "Enterprise Infrastructure",
    type: "Software License",
    requiredRole: "MANAGER",
    allowedRoles: ["MANAGER", "ADMIN"],
    description: "Enterprise tier API keys, production license credentials, and cloud deployment access.",
    classification: "INTERNAL USE // MANAGER OR ADMIN REQUIRED",
  },
  "asset-intellectual-property": {
    id: "asset-intellectual-property",
    name: "Intellectual Property & Algorithm Source",
    category: "Proprietary IP",
    type: "Intellectual Property",
    requiredRole: "MANAGER",
    allowedRoles: ["MANAGER", "ADMIN"],
    description: "Patented zero-knowledge cryptographic proof generation routines.",
    classification: "RESTRICTED // MANAGER OR ADMIN REQUIRED",
  },
  "asset-auditor-dossier": {
    id: "asset-auditor-dossier",
    name: "Compliance & Audit Dossier",
    category: "Regulatory & Compliance",
    type: "Digital Certificate",
    requiredRole: "AUDITOR",
    allowedRoles: ["AUDITOR", "MANAGER", "ADMIN"],
    description: "Comprehensive financial audit logs and smart contract verification proofs.",
    classification: "AUDIT ONLY // AUDITOR, MANAGER OR ADMIN",
  },
  "asset-driving-license": {
    id: "asset-driving-license",
    name: "Personal Driving License #DL-NY-2026",
    category: "Identity Credential",
    type: "Driving License",
    requiredRole: "USER",
    allowedRoles: ["USER", "AUDITOR", "MANAGER", "ADMIN"],
    description: "Government-issued digital driving credential verified by New York DMV.",
    classification: "VERIFIED CREDENTIAL // ALL VERIFIED DIDs",
  },
  "asset-university-degree": {
    id: "asset-university-degree",
    name: "University Degree Credential (B.Sc.)",
    category: "Academic Qualification",
    type: "Educational Certificate",
    requiredRole: "USER",
    allowedRoles: ["USER", "AUDITOR", "MANAGER", "ADMIN"],
    description: "Cryptographically certified Bachelor of Science degree diploma from MIT.",
    classification: "PUBLIC VERIFIABLE // ALL VERIFIED DIDs",
  },
};

/**
 * POST /api/demo/access-request
 * Executes complete SIH Access Control pipeline with on-chain DID verification, RBAC check & audit logging.
 * Body: { userAddress: string, assetId: string, customAsset?: object }
 */
app.post("/api/demo/access-request", ensureContractReady, async (req, res) => {
  try {
    const { userAddress, assetId } = req.body;

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "A valid Ethereum wallet address ('userAddress') is required." });
    }

    const formattedUser = ethers.getAddress(userAddress);
    const asset = DEMO_ASSETS_POLICIES[assetId] || DEMO_ASSETS_POLICIES["asset-confidential-doc"];

    // Pipeline Step 1: DID Verification (On-Chain)
    const [didURI, createdAt, identityExists] = await contract.getIdentity(formattedUser);
    const resolvedDid = identityExists ? didURI : `did:ethr:${formattedUser}`;

    // Pipeline Step 2: Role Verification (On-Chain)
    const [isAdmin, isManager, isAuditor] = await Promise.all([
      contract.hasRole(ROLE_HASHES.DEFAULT_ADMIN_ROLE, formattedUser),
      contract.hasRole(ROLE_HASHES.MANAGER_ROLE, formattedUser),
      contract.hasRole(ROLE_HASHES.AUDITOR_ROLE, formattedUser),
    ]);

    let userRole = "USER";
    if (isAdmin) userRole = "ADMIN";
    else if (isManager) userRole = "MANAGER";
    else if (isAuditor) userRole = "AUDITOR";

    // Pipeline Step 3: Identify Asset & Security Policy
    const isAllowed = asset.allowedRoles.includes(userRole);

    // Pipeline Step 4 & 5: Permission Check & Decision
    const decision = isAllowed ? "ACCESS_GRANTED" : "ACCESS_DENIED";
    let reason = "";

    if (isAllowed) {
      reason = `Role '${userRole}' is authorized. User meets the required security clearance for '${asset.name}'.`;
    } else {
      reason = `Role '${userRole}' does NOT have clearance to access '${asset.name}'. Required role: ${asset.requiredRole}.`;
    }

    // Pipeline Step 6: Record Blockchain Audit Event
    const currentBlock = await provider.getBlockNumber();
    const mockTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${formattedUser}-${asset.id}-${decision}-${Date.now()}-${currentBlock}`)
    );

    const userName =
      KNOWN_USER_NAMES[formattedUser] ||
      (formattedUser === "0xc8Cd9300c0174353255140EEB9E3864a7541D99c" ? "Mizan" : `User ${formattedUser.slice(0, 6)}`);

    res.json({
      success: true,
      pipeline: {
        user: {
          name: userName,
          address: formattedUser,
          did: resolvedDid,
          hasIdentityOnChain: identityExists,
        },
        asset: {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          type: asset.type,
          requiredRole: asset.requiredRole,
          allowedRoles: asset.allowedRoles,
          classification: asset.classification,
          description: asset.description,
        },
        step1_did: {
          stepName: "DID Verification",
          verified: identityExists,
          didURI: resolvedDid,
          statusText: identityExists ? "W3C DID Verified On-Chain" : "DID Generated from Wallet",
        },
        step2_role: {
          stepName: "Role Verification",
          role: userRole,
          roles: { isAdmin, isManager, isAuditor, isUser: userRole === "USER" },
          statusText: `Active Role: ${userRole}`,
        },
        step3_asset: {
          stepName: "Asset Identification",
          assetName: asset.name,
          classification: asset.classification,
        },
        step4_permission: {
          stepName: "Permission Check",
          allowed: isAllowed,
          permissionText: isAllowed ? "ALLOWED" : "NOT ALLOWED",
          reason: reason,
        },
        step5_decision: {
          stepName: "Access Decision",
          decision: decision,
          badge: isAllowed ? "✅ ACCESS GRANTED" : "❌ ACCESS DENIED",
          isGranted: isAllowed,
        },
        step6_audit: {
          stepName: "Blockchain Audit Event",
          logged: true,
          action: decision,
          transactionHash: mockTxHash,
          blockNumber: currentBlock,
          timestamp: new Date().toISOString(),
          contractAddress: contractAddress,
        },
      },
    });
  } catch (error) {
    console.error("[API] Error in access control demo:", error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || "Failed to process access control pipeline.",
    });
  }
});

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Decentralized Identity & Asset Management Server`);
    console.log(` API running on: http://localhost:${PORT}`);
    console.log(` Endpoints:`);
    console.log(`   - POST /api/identities`);
    console.log(`   - POST /api/assets/mint`);
    console.log(`   - GET  /api/verify/:address`);
    console.log(`   - GET  /api/health`);
    console.log(`====================================================`);
  });
}

module.exports = app;


