document.addEventListener("DOMContentLoaded", () => {
  // DOM References - Header & User Info
  const userNetworkName = document.getElementById("userNetworkName");
  const headerUsername = document.getElementById("headerUsername");
  const welcomeGreeting = document.getElementById("welcomeGreeting");
  const userRoleBadge = document.getElementById("userRoleBadge");
  const userAddressChip = document.getElementById("userAddressChip");
  const userWalletDisplay = document.getElementById("userWalletDisplay");
  const btnLogout = document.getElementById("btnLogout");
  const btnProfileLogout = document.getElementById("btnProfileLogout");

  // Tab Buttons & Panes
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // DID Tab Elements
  const didStatusBadge = document.getElementById("didStatusBadge");
  const userDidValue = document.getElementById("userDidValue");
  const userDidOnChainStatus = document.getElementById("userDidOnChainStatus");
  const userDidCreated = document.getElementById("userDidCreated");
  const userUpdateDidForm = document.getElementById("userUpdateDidForm");
  const customDidInput = document.getElementById("customDidInput");
  const btnSaveDid = document.getElementById("btnSaveDid");
  const btnSaveDidText = document.getElementById("btnSaveDidText");
  const btnSaveDidSpinner = document.getElementById("btnSaveDidSpinner");

  // Assets Tab Elements
  const userAssetsContainer = document.getElementById("userAssetsContainer");
  const btnRefreshUserAssets = document.getElementById("btnRefreshUserAssets");
  const btnOpenUploadModal = document.getElementById("btnOpenUploadModal");

  // Upload Modal Elements
  const userUploadCredForm = document.getElementById("userUploadCredForm");
  const uploadCredName = document.getElementById("uploadCredName");
  const uploadCredType = document.getElementById("uploadCredType");
  const uploadCredIssuer = document.getElementById("uploadCredIssuer");
  const uploadCredIdentifier = document.getElementById("uploadCredIdentifier");
  const uploadCredHolder = document.getElementById("uploadCredHolder");
  const uploadCredCategory = document.getElementById("uploadCredCategory");
  const uploadCredDesc = document.getElementById("uploadCredDesc");
  const uploadFileDropZone = document.getElementById("uploadFileDropZone");
  const uploadCredFileInput = document.getElementById("uploadCredFileInput");
  const uploadDocHashBox = document.getElementById("uploadDocHashBox");
  const uploadDocNameDisplay = document.getElementById("uploadDocNameDisplay");
  const uploadDocSizeDisplay = document.getElementById("uploadDocSizeDisplay");
  const uploadDocHashDisplay = document.getElementById("uploadDocHashDisplay");
  const btnSubmitUploadCred = document.getElementById("btnSubmitUploadCred");
  const btnSubmitUploadText = document.getElementById("btnSubmitUploadText");
  const btnSubmitUploadSpinner = document.getElementById("btnSubmitUploadSpinner");

  // View Modal Elements
  const viewCredDetailsContainer = document.getElementById("viewCredDetailsContainer");

  // Verify Tab Elements
  const userVerifyForm = document.getElementById("userVerifyForm");
  const verifyQueryInput = document.getElementById("verifyQueryInput");
  const btnUserVerify = document.getElementById("btnUserVerify");
  const btnVerifyText = document.getElementById("btnVerifyText");
  const btnVerifySpinner = document.getElementById("btnVerifySpinner");
  const userVerifyResultBox = document.getElementById("userVerifyResultBox");

  // Profile Elements
  const profileUsername = document.getElementById("profileUsername");
  const profileEmail = document.getElementById("profileEmail");
  const profileName = document.getElementById("profileName");
  const profileRole = document.getElementById("profileRole");
  const profileWallet = document.getElementById("profileWallet");

  let currentUser = null;
  let currentUserAssets = [];
  let selectedFileObj = null;

  // ==========================================
  // 1. Toast Notification Helper
  // ==========================================
  function showToast(message, type = "success") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = `
      <span>${type === "success" ? "✓" : "⚠"}</span>
      <span>${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Copy to clipboard helper
  function copyToClipboard(text, label = "Copied to clipboard") {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label}: ${text.length > 20 ? text.slice(0, 16) + "..." : text}`);
  }

  if (userAddressChip) {
    userAddressChip.addEventListener("click", () => {
      if (currentUser && currentUser.walletAddress) {
        copyToClipboard(currentUser.walletAddress, "Wallet Address");
      }
    });
  }

  // ==========================================
  // 2. Modal Management (Open & Close)
  // ==========================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  }

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      closeModal(modalId);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.remove("active");
    });
  });

  // Open Upload Modal Button
  if (btnOpenUploadModal) {
    btnOpenUploadModal.addEventListener("click", () => {
      if (currentUser) {
        const fullAddr = currentUser.walletAddress || "";
        uploadCredHolder.value = `${currentUser.username} (${fullAddr})`;
        const uploadCredWalletHint = document.getElementById("uploadCredWalletHint");
        if (uploadCredWalletHint) uploadCredWalletHint.textContent = fullAddr;
      }
      openModal("modalUploadCredential");
    });
  }

  // ==========================================
  // 3. Tab Navigation
  // ==========================================
  function switchTab(tabId) {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    if (btn) btn.classList.add("active");

    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add("active");
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      switchTab(targetId);
    });
  });

  // ==========================================
  // 4. File Drop & Real-time SHA-256 Hashing
  // ==========================================
  async function computeSHA256(arrayBuffer) {
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleFileSelected(file) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const hash = await computeSHA256(buffer);

      const sizeStr = file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(2) + " MB"
        : (file.size / 1024).toFixed(1) + " KB";

      selectedFileObj = {
        name: file.name,
        size: sizeStr,
        hash: hash,
        type: file.type,
      };

      uploadDocNameDisplay.textContent = file.name;
      uploadDocSizeDisplay.textContent = sizeStr;
      uploadDocHashDisplay.textContent = hash;
      uploadDocHashBox.style.display = "block";

      showToast(`Computed SHA-256 document hash for ${file.name}`);
    } catch (err) {
      console.error("Error computing hash:", err);
      showToast("Could not compute file hash", "error");
    }
  }

  if (uploadFileDropZone && uploadCredFileInput) {
    uploadFileDropZone.addEventListener("click", () => {
      uploadCredFileInput.click();
    });

    uploadCredFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0]);
      }
    });

    uploadFileDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadFileDropZone.classList.add("dragover");
    });

    uploadFileDropZone.addEventListener("dragleave", () => {
      uploadFileDropZone.classList.remove("dragover");
    });

    uploadFileDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadFileDropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  // ==========================================
  // 5. Authentication & Session Check
  // ==========================================
  async function checkAuthSession() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();

      if (!data.authenticated || !data.user) {
        window.location.href = "/login";
        return;
      }

      currentUser = data.user;

      // Update UI with authenticated user details
      headerUsername.textContent = currentUser.username;
      welcomeGreeting.textContent = `Welcome, ${currentUser.username}`;
      userRoleBadge.textContent = `${currentUser.role} Role`;

      const fullAddr = currentUser.walletAddress || "0x0000000000000000000000000000000000000000";
      userWalletDisplay.textContent = `${fullAddr.slice(0, 6)}...${fullAddr.slice(-4)}`;
      userAddressChip.title = `Full Wallet: ${fullAddr}`;

      if (uploadCredHolder) {
        uploadCredHolder.value = `${currentUser.username} (${fullAddr})`;
      }
      const uploadCredWalletHint = document.getElementById("uploadCredWalletHint");
      if (uploadCredWalletHint) {
        uploadCredWalletHint.textContent = fullAddr;
      }

      // Update Profile Tab
      profileUsername.textContent = currentUser.username;
      profileEmail.textContent = currentUser.email || "N/A";
      profileName.textContent = currentUser.name || currentUser.username;
      profileRole.textContent = currentUser.role;
      profileWallet.textContent = fullAddr;

      // Fetch User's Identity & Assets
      loadUserIdentity();
      loadUserAssets();
    } catch (err) {
      console.error("Session check error:", err);
      window.location.href = "/login";
    }
  }

  // ==========================================
  // 6. Fetch Network & Blockchain Health
  // ==========================================
  async function fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.status === "OK") {
        userNetworkName.textContent = `Hardhat (Chain ID ${data.network.chainId})`;
      } else {
        userNetworkName.textContent = "Blockchain Offline";
      }
    } catch {
      userNetworkName.textContent = "Connecting to Node...";
    }
  }

  // ==========================================
  // 7. Load User DID & Identity Info
  // ==========================================
  async function loadUserIdentity() {
    if (!currentUser || !currentUser.walletAddress) return;

    try {
      const res = await fetch(`/api/user/identity`);
      const data = await res.json();

      if (data.success && data.identity) {
        const id = data.identity;
        userDidValue.textContent = id.didURI;
        if (id.exists) {
          didStatusBadge.textContent = "Active On-Chain";
          didStatusBadge.style.background = "rgba(16, 185, 129, 0.15)";
          didStatusBadge.style.color = "#34d399";
          userDidOnChainStatus.innerHTML = '<span style="color: #34d399;">● Verified On-Chain</span>';
          userDidCreated.textContent = id.createdAt ? new Date(id.createdAt).toLocaleString() : "Recently registered";
        } else {
          didStatusBadge.textContent = "Generated (Unregistered)";
          didStatusBadge.style.background = "rgba(245, 158, 11, 0.15)";
          didStatusBadge.style.color = "#fbbf24";
          userDidOnChainStatus.innerHTML = '<span style="color: #fbbf24;">● Not yet registered on-chain</span>';
          userDidCreated.textContent = "Pending Registration";
        }
      }
    } catch (err) {
      console.error("Error loading user identity:", err);
    }
  }

  // Update Custom DID Submit
  userUpdateDidForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.walletAddress) return;

    const customDid = customDidInput.value.trim();

    btnSaveDid.disabled = true;
    btnSaveDidText.textContent = "Saving to Hardhat Node...";
    btnSaveDidSpinner.style.display = "inline-block";

    try {
      const res = await fetch("/api/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: currentUser.walletAddress,
          customDid: customDid || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast("DID successfully registered on-chain!");
        customDidInput.value = "";
        loadUserIdentity();
      } else {
        showToast(data.error || "Failed to update DID", "error");
      }
    } catch (err) {
      console.error("Error registering DID:", err);
      showToast("Network error registering DID.", "error");
    } finally {
      btnSaveDid.disabled = false;
      btnSaveDidText.textContent = "Save On-Chain";
      btnSaveDidSpinner.style.display = "none";
    }
  });

  // ==========================================
  // 8. Upload / Submit Credential Form
  // ==========================================
  userUploadCredForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.walletAddress) return;

    const name = uploadCredName.value.trim();
    const assetType = uploadCredType.value;
    const issuer = uploadCredIssuer.value.trim();
    const identifier = uploadCredIdentifier.value.trim();
    const category = uploadCredCategory.value.trim();
    const description = uploadCredDesc.value.trim();

    btnSubmitUploadCred.disabled = true;
    btnSubmitUploadText.textContent = "Processing & Minting...";
    btnSubmitUploadSpinner.style.display = "inline-block";

    try {
      const payload = {
        name,
        assetType,
        issuer,
        identifier,
        fullName: currentUser.username,
        recipient: currentUser.walletAddress,
        category,
        description,
        documentName: selectedFileObj ? selectedFileObj.name : "credential-document.pdf",
        documentHash: selectedFileObj ? selectedFileObj.hash : undefined,
        documentSize: selectedFileObj ? selectedFileObj.size : "Verified Document",
      };

      const res = await fetch("/api/user/credentials/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Credential #${data.credential.tokenId} successfully minted on-chain!`);
        closeModal("modalUploadCredential");
        userUploadCredForm.reset();
        selectedFileObj = null;
        uploadDocHashBox.style.display = "none";

        // Refresh user credential list immediately
        await loadUserAssets();
      } else {
        showToast(data.error || "Failed to upload credential", "error");
      }
    } catch (err) {
      console.error("Error uploading credential:", err);
      showToast("Network error uploading credential.", "error");
    } finally {
      btnSubmitUploadCred.disabled = false;
      btnSubmitUploadText.textContent = "Upload & Mint to Blockchain";
      btnSubmitUploadSpinner.style.display = "none";
    }
  });

  // ==========================================
  // 9. Load User Credentials & Digital Assets
  // ==========================================
  async function loadUserAssets() {
    if (!currentUser || !currentUser.walletAddress) return;

    userAssetsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 36px; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 12px;"></div>
        Querying ERC-721 smart contract for owned credential tokens...
      </div>
    `;

    try {
      const res = await fetch(`/api/user/assets`);
      const data = await res.json();

      if (data.success && data.assets && data.assets.length > 0) {
        currentUserAssets = data.assets;
        userAssetsContainer.innerHTML = "";

        data.assets.forEach((asset) => {
          const card = document.createElement("div");
          card.className = "asset-card-user";
          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="asset-badge">${escapeHtml(asset.type || "Digital Asset")}</span>
              <span class="mono" style="font-size: 0.78rem; color: #a5b4fc; background: rgba(99,102,241,0.1); padding: 2px 6px; border-radius: 4px;">Token #${asset.tokenId}</span>
            </div>

            <h4 class="asset-name">${escapeHtml(asset.name || "Credential Token")}</h4>

            <div style="font-size: 0.83rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 5px;">
              <div><span style="color: #64748b;">Issuer:</span> <strong>${escapeHtml(asset.issuer || asset.authority || "Credexa Authority")}</strong></div>
              <div><span style="color: #64748b;">ID / Cert:</span> <span class="mono">${escapeHtml(asset.identifier || `ID-${asset.tokenId}`)}</span></div>
              <div><span style="color: #64748b;">Issued Date:</span> ${escapeHtml(asset.issueDate ? String(asset.issueDate).slice(0, 10) : "2026")}</div>
              ${asset.documentHash ? `<div><span style="color: #64748b;">SHA-256:</span> <span class="mono" style="font-size: 0.74rem; color: #a5b4fc;">${asset.documentHash.slice(0, 10)}...${asset.documentHash.slice(-8)}</span></div>` : ""}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
              <span style="font-size: 0.72rem; color: #10b981; display: inline-flex; align-items: center; gap: 4px;">
                <span class="pulse-dot" style="background: #10b981;"></span>
                Verified On-Chain
              </span>
            </div>

            <!-- Action Buttons: [ View ] [ Verify ] -->
            <div class="card-actions-row">
              <button class="btn-card-action btn-card-view" data-view-token="${asset.tokenId}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View
              </button>
              <button class="btn-card-action btn-card-verify" data-verify-token="${asset.tokenId}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Verify
              </button>
            </div>
          `;
          userAssetsContainer.appendChild(card);
        });

        // Wire View Buttons
        document.querySelectorAll("[data-view-token]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tokenId = btn.getAttribute("data-view-token");
            viewCredentialDetails(tokenId);
          });
        });

        // Wire Verify Buttons
        document.querySelectorAll("[data-verify-token]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tokenId = btn.getAttribute("data-verify-token");
            executeVerifyQuery(tokenId);
          });
        });
      } else {
        userAssetsContainer.innerHTML = `
          <div class="empty-state-box" style="grid-column: 1 / -1;">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 14px; color: #64748b;">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <h4 style="color: #cbd5e1; margin-bottom: 6px; font-size: 1.1rem;">No Digital Credentials Found</h4>
            <p style="font-size: 0.88rem; margin-bottom: 18px;">You haven't uploaded or been issued any verifiable credentials yet.</p>
            <button class="btn btn-primary" onclick="document.getElementById('btnOpenUploadModal').click()" style="padding: 10px 20px;">
              Upload Your First Credential
            </button>
          </div>
        `;
      }
    } catch (err) {
      console.error("Error loading user assets:", err);
      userAssetsContainer.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1; border-color: rgba(239,68,68,0.3);">
          <p style="color: #f87171;">Failed to load credentials from blockchain node.</p>
        </div>
      `;
    }
  }

  if (btnRefreshUserAssets) {
    btnRefreshUserAssets.addEventListener("click", () => {
      loadUserAssets();
      showToast("Refreshing credentials from blockchain...");
    });
  }

  // ==========================================
  // 10. View Credential Details Modal Handler
  // ==========================================
  function viewCredentialDetails(tokenId) {
    const asset = currentUserAssets.find((a) => a.tokenId === String(tokenId));
    if (!asset) {
      showToast("Credential not found", "error");
      return;
    }

    viewCredDetailsContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <span class="asset-badge" style="font-size: 0.8rem; padding: 4px 12px;">${escapeHtml(asset.type || "Credential")}</span>
        <span class="mono" style="color: #818cf8; font-weight: 700;">Token ID: #${asset.tokenId}</span>
      </div>

      <h3 style="color: #fff; font-size: 1.25rem; margin-bottom: 14px;">${escapeHtml(asset.name)}</h3>

      <div style="background: rgba(0,0,0,0.3); border-radius: 10px; border: 1px solid var(--border-color); padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 0.86rem;">
        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Holder:</span> <strong style="color: #fff;">${escapeHtml(asset.fullName)}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Issuer:</span> <strong style="color: #fff;">${escapeHtml(asset.issuer || asset.authority)}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Credential ID:</span> <span class="mono">${escapeHtml(asset.identifier)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Category:</span> <span>${escapeHtml(asset.category)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Issue Date:</span> <span>${escapeHtml(String(asset.issueDate).slice(0, 10))}</span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Status:</span> <span style="color: #34d399; font-weight: 600;">✓ ${escapeHtml(asset.status || "Verified On-Chain")}</span></div>
        ${asset.documentName ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Document File:</span> <span>${escapeHtml(asset.documentName)}</span></div>` : ""}
        ${asset.documentHash ? `
          <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; margin-top: 4px;">
            <div style="color: #64748b; font-size: 0.76rem; margin-bottom: 2px;">SHA-256 Cryptographic Hash:</div>
            <div class="mono" style="color: #a5b4fc; font-size: 0.76rem; word-break: break-all;">${asset.documentHash}</div>
          </div>
        ` : ""}
      </div>

      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn" data-close-modal="modalViewCredential">Close</button>
        <button type="button" class="btn btn-primary" onclick="closeModal('modalViewCredential'); executeVerifyQuery('${asset.tokenId}')">
          Verify On Blockchain
        </button>
      </div>
    `;

    // Re-attach close listeners inside modal
    viewCredDetailsContainer.querySelectorAll("[data-close-modal]").forEach((b) => {
      b.addEventListener("click", () => closeModal("modalViewCredential"));
    });

    openModal("modalViewCredential");
  }

  // ==========================================
  // 11. Execute Verification Query
  // ==========================================
  async function executeVerifyQuery(query) {
    if (!query) return;

    // Switch to Verify tab and populate input
    switchTab("tabVerify");
    verifyQueryInput.value = query;

    btnUserVerify.disabled = true;
    btnVerifyText.textContent = "Verifying...";
    btnVerifySpinner.style.display = "inline-block";
    userVerifyResultBox.style.display = "block";

    userVerifyResultBox.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px;">
        <div class="spinner" style="margin: 0 auto 10px;"></div>
        Querying on-chain state & verifying cryptographic signatures for: <code>${escapeHtml(query)}</code>
      </div>
    `;

    try {
      const res = await fetch("/api/user/credentials/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.verified) {
        const d = data.data;
        userVerifyResultBox.innerHTML = `
          <!-- Success Banner -->
          <div class="verify-banner verify-banner-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div>
              <div class="verify-badge-title">✓ Credential Verified</div>
              <div style="font-size: 0.84rem; opacity: 0.9;">Cryptographically validated on Hardhat blockchain ledger.</div>
            </div>
          </div>

          <!-- Credential Details Table -->
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem;">
            ${d.tokenId ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Token ID:</span> <strong class="mono" style="color: #a5b4fc;">#${d.tokenId}</strong></div>` : ""}
            ${d.name ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Credential Name:</span> <strong style="color: #fff;">${escapeHtml(d.name)}</strong></div>` : ""}
            ${d.type ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Type:</span> <span>${escapeHtml(d.type)}</span></div>` : ""}
            ${d.issuer ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Issuing Authority:</span> <span>${escapeHtml(d.issuer)}</span></div>` : ""}
            ${d.owner ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Owner / Recipient:</span> <span class="mono">${escapeHtml(d.owner)}</span></div>` : ""}
            ${d.ownerDid ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">DID Identifier:</span> <span class="mono" style="color: #818cf8;">${escapeHtml(d.ownerDid)}</span></div>` : ""}
            ${d.documentName ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Document File:</span> <span>${escapeHtml(d.documentName)}</span></div>` : ""}
            ${d.documentHash ? `
              <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; margin-top: 4px;">
                <div style="color: #64748b; font-size: 0.76rem; margin-bottom: 2px;">Document SHA-256 Hash:</div>
                <div class="mono" style="color: #34d399; font-size: 0.78rem; word-break: break-all;">${d.documentHash}</div>
              </div>
            ` : ""}
            <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;"><span style="color: #64748b;">Contract Address:</span> <span class="mono" style="font-size: 0.78rem;">${d.contractAddress || "IdentityAssetManager"}</span></div>
          </div>
        `;
      } else {
        userVerifyResultBox.innerHTML = `
          <!-- Failure Banner -->
          <div class="verify-banner verify-banner-failed">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <div>
              <div class="verify-badge-title">✗ Credential Verification Failed</div>
              <div style="font-size: 0.84rem; opacity: 0.9;">${escapeHtml(data.error || "The supplied credential ID or hash could not be verified on the blockchain.")}</div>
            </div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 0.84rem; color: var(--text-muted); border: 1px solid var(--border-color);">
            Ensure the token has been issued by an authorized administrator or uploaded through your portal, and that the Hardhat node is active.
          </div>
        `;
      }
    } catch (err) {
      console.error("Verification error:", err);
      userVerifyResultBox.innerHTML = `
        <div class="verify-banner verify-banner-failed">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <div>
            <div class="verify-badge-title">✗ Credential Verification Failed</div>
            <div style="font-size: 0.84rem; opacity: 0.9;">Network error executing on-chain verification.</div>
          </div>
        </div>
      `;
    } finally {
      btnUserVerify.disabled = false;
      btnVerifyText.textContent = "Verify Credential";
      btnVerifySpinner.style.display = "none";
    }
  }

  // Verify Form Submit Handler
  userVerifyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = verifyQueryInput.value.trim();
    if (query) executeVerifyQuery(query);
  });

  // Expose executeVerifyQuery globally for inline button calls
  window.executeVerifyQuery = executeVerifyQuery;
  window.closeModal = closeModal;

  // ==========================================
  // 12. Logout Handling
  // ==========================================
  async function performLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      window.location.href = data.redirectUrl || "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  if (btnLogout) btnLogout.addEventListener("click", performLogout);
  if (btnProfileLogout) btnProfileLogout.addEventListener("click", performLogout);

  // Change Wallet Prompt Handler
  const btnChangeWalletPrompt = document.getElementById("btnChangeWalletPrompt");
  if (btnChangeWalletPrompt) {
    btnChangeWalletPrompt.addEventListener("click", async () => {
      const current = (currentUser && currentUser.walletAddress) || "";
      const newAddress = window.prompt("Enter new sovereign Ethereum wallet address (0x...):", current);
      if (!newAddress || newAddress.trim() === "" || newAddress.trim().toLowerCase() === current.toLowerCase()) return;

      try {
        const res = await fetch("/api/user/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: newAddress.trim() }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast("Wallet address successfully updated!");
          checkAuthSession();
        } else {
          showToast(data.message || "Failed to update wallet", "error");
        }
      } catch (err) {
        showToast("Error updating wallet: " + err.message, "error");
      }
    });
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize
  fetchHealth();
  checkAuthSession();
});
