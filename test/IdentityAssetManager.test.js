const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityAssetManager Smart Contract", function () {
  let IdentityAssetManager;
  let contract;
  let admin, manager, auditor, user1, user2;
  let MANAGER_ROLE, AUDITOR_ROLE, DEFAULT_ADMIN_ROLE;

  beforeEach(async function () {
    [admin, manager, auditor, user1, user2] = await ethers.getSigners();

    IdentityAssetManager = await ethers.getContractFactory("IdentityAssetManager");
    contract = await IdentityAssetManager.deploy(admin.address);
    await contract.waitForDeployment();

    DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    MANAGER_ROLE = await contract.MANAGER_ROLE();
    AUDITOR_ROLE = await contract.AUDITOR_ROLE();

    // Grant MANAGER_ROLE to manager and AUDITOR_ROLE to auditor
    await contract.grantRole(MANAGER_ROLE, manager.address);
    await contract.grantRole(AUDITOR_ROLE, auditor.address);
  });

  describe("Role-Based Access Control (RBAC)", function () {
    it("Should assign DEFAULT_ADMIN_ROLE and MANAGER_ROLE to admin upon deployment", async function () {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await contract.hasRole(MANAGER_ROLE, admin.address)).to.be.true;
    });

    it("Should allow admin to grant and revoke roles", async function () {
      expect(await contract.hasRole(MANAGER_ROLE, manager.address)).to.be.true;
      expect(await contract.hasRole(AUDITOR_ROLE, auditor.address)).to.be.true;

      await contract.revokeRole(MANAGER_ROLE, manager.address);
      expect(await contract.hasRole(MANAGER_ROLE, manager.address)).to.be.false;
    });
  });

  describe("Decentralized Identifiers (DIDs)", function () {
    const didUser1 = "did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    it("Should allow a user to register their own DID", async function () {
      await expect(contract.connect(user1).registerIdentity(user1.address, didUser1))
        .to.emit(contract, "IdentityCreated")
        .withArgs(user1.address, didUser1, (val) => val > 0);

      const identity = await contract.getIdentity(user1.address);
      expect(identity.didURI).to.equal(didUser1);
      expect(identity.exists).to.be.true;
      expect(identity.createdAt).to.be.gt(0);
    });

    it("Should allow a Manager or Admin to register a DID on behalf of a user", async function () {
      await expect(contract.connect(manager).registerIdentity(user1.address, didUser1))
        .to.emit(contract, "IdentityCreated");

      const identity = await contract.getIdentity(user1.address);
      expect(identity.didURI).to.equal(didUser1);
      expect(identity.exists).to.be.true;
    });

    it("Should reject identity registration by unauthorized non-owner", async function () {
      await expect(
        contract.connect(user2).registerIdentity(user1.address, didUser1)
      ).to.be.revertedWith("Caller not authorized to register identity");
    });
  });

  describe("NFT Asset Minting", function () {
    const sampleTokenURI = "data:application/json;base64,eyJuYW1lIjoiRHJpdmluZyBMaWNlbnNlIn0=";

    it("Should allow Admin to mint digital asset credentials", async function () {
      await expect(contract.connect(admin).mintDigitalAsset(user1.address, sampleTokenURI))
        .to.emit(contract, "AssetMinted")
        .withArgs(user1.address, 1n, sampleTokenURI, (val) => val > 0);

      expect(await contract.ownerOf(1)).to.equal(user1.address);
      expect(await contract.tokenURI(1)).to.equal(sampleTokenURI);

      const assets = await contract.getUserAssets(user1.address);
      expect(assets.length).to.equal(1);
      expect(assets[0]).to.equal(1n);
    });

    it("Should allow Manager to mint digital asset credentials", async function () {
      await expect(contract.connect(manager).mintDigitalAsset(user1.address, sampleTokenURI))
        .to.emit(contract, "AssetMinted");

      expect(await contract.ownerOf(1)).to.equal(user1.address);
    });

    it("Should reject minting from accounts without Admin or Manager role", async function () {
      await expect(
        contract.connect(user1).mintDigitalAsset(user1.address, sampleTokenURI)
      ).to.be.revertedWith("Must have Admin or Manager role to mint assets");

      await expect(
        contract.connect(auditor).mintDigitalAsset(user1.address, sampleTokenURI)
      ).to.be.revertedWith("Must have Admin or Manager role to mint assets");
    });

    it("Should correctly track multiple assets for a user", async function () {
      await contract.connect(manager).mintDigitalAsset(user1.address, "uri://asset-1");
      await contract.connect(manager).mintDigitalAsset(user1.address, "uri://asset-2");

      const assets = await contract.getUserAssets(user1.address);
      expect(assets.length).to.equal(2);
      expect(assets[0]).to.equal(1n);
      expect(assets[1]).to.equal(2n);
    });
  });
});
