# Decentralized Identity and Asset Management System

A production-ready prototype for a **Decentralized Identity (DID) and Asset Management System** built with **Solidity (Smart Contract)**, **Hardhat**, **Ethers.js (v6)**, and a **Node.js (Express) Relayer Backend**.

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC)**:
   - Uses OpenZeppelin's `AccessControl`.
   - Supported Roles: `DEFAULT_ADMIN_ROLE`, `MANAGER_ROLE`, and `AUDITOR_ROLE`.
2. **Decentralized Identifiers (DIDs)**:
   - On-chain mapping associating wallet addresses with W3C-compliant DID strings (e.g. `did:ethr:0x123...`).
   - Audit trail emitting `IdentityCreated` and `IdentityUpdated` events.
3. **ERC-721 Digital Asset (NFT) Credentials**:
   - Minting verifiable credentials (e.g., Driving Licenses, Certificates) with self-contained JSON/Base64 metadata.
   - Enforces Admin/Manager authorization for minting.
   - User asset indexer allowing fast credential verification.
4. **Relayer Express API**:
   - Seamless REST API handling blockchain transactions, signing, and metadata encoding.

---

## 📁 Project Structure

```
prj/
├── contracts/
│   └── IdentityAssetManager.sol    # Smart contract (RBAC + DID + ERC721)
├── scripts/
│   └── deploy.js                   # Hardhat deployment script (saves deployment.json)
├── test/
│   └── IdentityAssetManager.test.js# Automated test suite
├── server.js                       # Express.js REST API relayer
├── hardhat.config.js               # Hardhat configuration
├── package.json                    # Dependencies & scripts
└── .env.example                    # Environment variable template
```

---

## 🚀 Quickstart Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Smart Contract Test Suite
```bash
npm test
```

### 3. Start a Local Hardhat Blockchain Node
Open a terminal and run:
```bash
npm run node
```
This starts a local Ethereum node at `http://127.0.0.1:8545` with 20 pre-funded test accounts.

### 4. Deploy the Smart Contract
In a second terminal, deploy the contract to the local network:
```bash
npm run deploy
```
This deploys `IdentityAssetManager.sol` and automatically saves the contract address and ABI into `deployment.json`.

### 5. Start the Express API Backend
In the second terminal, start the server:
```bash
npm start
```
The API will be running on `http://localhost:3000`.

---

## 📡 REST API Reference

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
```json
{
  "status": "OK",
  "network": { "chainId": "31337", "name": "unknown" },
  "relayer": { "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "balanceEth": "9999.98" },
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
}
```

---

### 2. Register a Decentralized Identity (DID)
- **Endpoint**: `POST /api/identities`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```
*(Optionally include `"customDid": "did:mycustom:0x..."`)*
- **Example cURL**:
```bash
curl -X POST http://localhost:3000/api/identities \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\"}"
```
- **Response**:
```json
{
  "success": true,
  "message": "Decentralized Identity (DID) successfully registered on-chain.",
  "data": {
    "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "didURI": "did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "transactionHash": "0x...",
    "blockNumber": 2,
    "gasUsed": "48154"
  }
}
```

---

### 3. Mint a Digital Asset Credential (NFT)
- **Endpoint**: `POST /api/assets/mint`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "to": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "assetType": "Driving License",
  "details": {
    "licenseNumber": "DL-NY-2026-98124",
    "fullName": "Alice Smith",
    "category": "Class C / Passenger Vehicle",
    "issueDate": "2024-05-10",
    "expiryDate": "2034-05-10",
    "issuingAuthority": "State Department of Motor Vehicles"
  }
}
```
- **Example cURL**:
```bash
curl -X POST http://localhost:3000/api/assets/mint \
  -H "Content-Type: application/json" \
  -d "{\"to\": \"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\", \"assetType\": \"Driving License\", \"details\": {\"licenseNumber\": \"DL-NY-2026-98124\", \"fullName\": \"Alice Smith\", \"category\": \"Class C\"}}"
```
- **Response**:
```json
{
  "success": true,
  "message": "Digital asset credential NFT minted successfully.",
  "data": {
    "tokenId": "1",
    "recipient": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "tokenURI": "data:application/json;base64,...",
    "metadata": {
      "name": "Driving License - Alice Smith",
      "description": "Decentralized digital asset credential (Driving License) verified on-chain.",
      "assetType": "Driving License",
      "attributes": [...]
    },
    "transactionHash": "0x...",
    "blockNumber": 3,
    "gasUsed": "112340"
  }
}
```

---

### 4. Verify Identity & Credentials
- **Endpoint**: `GET /api/verify/:address`
- **Example cURL**:
```bash
curl http://localhost:3000/api/verify/0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```
- **Response**:
```json
{
  "success": true,
  "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "isVerified": true,
  "identity": {
    "exists": true,
    "didURI": "did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "createdAt": "2026-08-31T10:45:00.000Z"
  },
  "assetsCount": 1,
  "assets": [
    {
      "tokenId": "1",
      "tokenURI": "data:application/json;base64,...",
      "metadata": {
        "name": "Driving License - Alice Smith",
        "assetType": "Driving License",
        "attributes": [
          { "trait_type": "licenseNumber", "value": "DL-NY-2026-98124" },
          { "trait_type": "fullName", "value": "Alice Smith" }
        ]
      }
    }
  ]
}
```
