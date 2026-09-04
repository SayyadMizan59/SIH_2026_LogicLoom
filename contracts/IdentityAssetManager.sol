// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IdentityAssetManager
 * @dev Smart Contract for Decentralized Identity (DID) registration and Role-Governed Digital Asset (NFT) Minting.
 */
contract IdentityAssetManager is ERC721URIStorage, AccessControl {
    // Role Definitions
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // Token ID Counter
    uint256 private _nextTokenId;

    // Decentralized Identity Struct
    struct Identity {
        string didURI;        // DID string, e.g., "did:ethr:0x..."
        uint256 createdAt;    // Timestamp of registration
        bool exists;          // Existence flag
    }

    // Mapping from wallet address to Identity
    mapping(address => Identity) private _identities;

    // Mapping from wallet address to list of owned token IDs for credential verification
    mapping(address => uint256[]) private _userAssets;

    // Events for Audit Trail
    event IdentityCreated(
        address indexed user,
        string didURI,
        uint256 timestamp
    );

    event IdentityUpdated(
        address indexed user,
        string didURI,
        uint256 timestamp
    );

    event AssetMinted(
        address indexed to,
        uint256 indexed tokenId,
        string tokenURI,
        uint256 timestamp
    );

    /**
     * @dev Initializes contract, sets up ERC721 metadata, and grants initial roles to deployer.
     */
    constructor(address initialAdmin) ERC721("IdentityAssetCredential", "IDAC") {
        address admin = initialAdmin == address(0) ? msg.sender : initialAdmin;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    // ==========================================
    // DECENTRALIZED IDENTIFIER (DID) FUNCTIONS
    // ==========================================

    /**
     * @notice Registers or updates a Decentralized Identifier (DID) for a user wallet.
     * @dev Can be invoked by the user themselves or by an authorized Admin/Manager.
     * @param user The wallet address associated with the DID.
     * @param didURI The DID string (e.g., "did:ethr:0x123...").
     */
    function registerIdentity(address user, string memory didURI) external {
        require(user != address(0), "Invalid user address");
        require(bytes(didURI).length > 0, "DID string cannot be empty");
        
        // Caller must be either the user themselves, or have Admin/Manager privileges
        require(
            msg.sender == user ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(MANAGER_ROLE, msg.sender),
            "Caller not authorized to register identity"
        );

        bool isNew = !_identities[user].exists;
        _identities[user] = Identity({
            didURI: didURI,
            createdAt: block.timestamp,
            exists: true
        });

        if (isNew) {
            emit IdentityCreated(user, didURI, block.timestamp);
        } else {
            emit IdentityUpdated(user, didURI, block.timestamp);
        }
    }

    /**
     * @notice Fetches the DID details for a given wallet address.
     * @param user The address to query.
     */
    function getIdentity(address user) external view returns (string memory didURI, uint256 createdAt, bool exists) {
        Identity memory id = _identities[user];
        return (id.didURI, id.createdAt, id.exists);
    }

    // ==========================================
    // ASSET (NFT) MINTING & CREDENTIAL FUNCTIONS
    // ==========================================

    /**
     * @notice Mints a new digital asset (credential NFT) to a recipient.
     * @dev Restricted to accounts with DEFAULT_ADMIN_ROLE or MANAGER_ROLE.
     * @param to The recipient wallet address.
     * @param tokenURI The URI containing asset/credential metadata.
     * @return tokenId The ID of the newly minted NFT.
     */
    function mintDigitalAsset(
        address to,
        string memory tokenURI
    ) external returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(MANAGER_ROLE, msg.sender),
            "Must have Admin or Manager role to mint assets"
        );

        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _userAssets[to].push(tokenId);

        emit AssetMinted(to, tokenId, tokenURI, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Returns all token IDs owned by a given user wallet address.
     * @param user The address to query.
     */
    function getUserAssets(address user) external view returns (uint256[] memory) {
        return _userAssets[user];
    }

    /**
     * @notice Returns total number of digital assets minted so far.
     */
    function totalAssets() external view returns (uint256) {
        return _nextTokenId;
    }

    // ==========================================
    // OVERRIDES & INTERFACES
    // ==========================================

    /**
     * @dev Required override for ERC721URIStorage and AccessControl.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
