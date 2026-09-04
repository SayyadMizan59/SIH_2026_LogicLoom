document.addEventListener("DOMContentLoaded", () => {
  // DOM References - Header & Stats
  const networkNameVal = document.getElementById("networkNameVal");
  const chainIdVal = document.getElementById("chainIdVal");
  const contractAddressVal = document.getElementById("contractAddressVal");
  const relayerBalanceVal = document.getElementById("relayerBalanceVal");
  const contractChip = document.getElementById("contractChip");

  // Summary Metrics
  const statTotalUsers = document.getElementById("statTotalUsers");
  const statRegisteredDids = document.getElementById("statRegisteredDids");
  const statDigitalAssets = document.getElementById("statDigitalAssets");
  const statTotalNfts = document.getElementById("statTotalNfts");
  const statActiveRoles = document.getElementById("statActiveRoles");
  const statTotalTxs = document.getElementById("statTotalTxs");

  // Activity Stream Elements
  const activityStreamContainer = document.getElementById("activityStreamContainer");
  const activityCountBadge = document.getElementById("activityCountBadge");
  const activitySearchInput = document.getElementById("activitySearchInput");
  const filterPills = document.querySelectorAll(".filter-pill");

  // Refresh
  const btnManualRefresh = document.getElementById("btnManualRefresh");
  const refreshIcon = document.getElementById("refreshIcon");

  // Modals
  const btnActionRegister = document.getElementById("btnActionRegister");
  const btnActionRole = document.getElementById("btnActionRole");
  const btnActionMint = document.getElementById("btnActionMint");
  const btnActionManageAssets = document.getElementById("btnActionManageAssets");
  const btnActionAuditTrail = document.getElementById("btnActionAuditTrail");

  // Global State
  let allActivities = [];
  let allAssets = [];
  let currentFilter = "all";
  let fullContractAddress = "";

  // ==========================================
  // 1. Toast Notification Helper
  // ==========================================
  function showToast(message, type = "success") {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = `
      <span>${type === "success" ? "✓" : "⚠"}</span>
      <span>${message}</span>
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
    navigator.clipboard.writeText(text);
    showToast(`${label}: ${text.slice(0, 10)}...`);
  }

  // ==========================================
  // 2. Fetch and Render Admin Stats
  // ==========================================
  async function loadAdminStats() {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();

      if (data.success) {
        // Network & Top Bar
        networkNameVal.textContent = data.network.name || "Hardhat";
        chainIdVal.textContent = data.network.chainId || "31337";

        fullContractAddress = data.contract.address;
        contractAddressVal.textContent = `${fullContractAddress.slice(0, 6)}...${fullContractAddress.slice(-4)}`;
        contractAddressVal.title = fullContractAddress;

        relayerBalanceVal.textContent = `${parseFloat(data.relayer.balanceEth).toFixed(4)} ETH`;
        relayerBalanceVal.title = `Relayer: ${data.relayer.address}`;

        // Summary Metric Cards
        animateCounter(statTotalUsers, data.stats.totalUsers);
        animateCounter(statRegisteredDids, data.stats.registeredDids);
        animateCounter(statDigitalAssets, data.stats.totalDigitalAssets);
        animateCounter(statTotalNfts, data.stats.totalNfts);
        animateCounter(statActiveRoles, data.stats.activeRoles);
        animateCounter(statTotalTxs, data.stats.totalTransactions);

        // Update Role holders list in modal
        updateRoleHoldersDisplay(data.roleHolders);
      }
    } catch (err) {
      console.error("Error loading admin stats:", err);
    }
  }

  // Animate counter values
  function animateCounter(element, target) {
    if (!element) return;
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;

    let start = current;
    const duration = 500;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = (target - start) / steps;

    let stepCount = 0;
    const timer = setInterval(() => {
      stepCount++;
      start += increment;
      if (stepCount >= steps) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.round(start);
      }
    }, stepTime);
  }

  // ==========================================
  // 3. Fetch and Render Recent Blockchain Activities
  // ==========================================
  async function loadAdminActivities() {
    try {
      const res = await fetch("/api/admin/activities");
      const data = await res.json();

      if (data.success) {
        allActivities = data.activities;
        activityCountBadge.textContent = `${allActivities.length} Events Logged`;
        renderActivities();
      }
    } catch (err) {
      console.error("Error loading activities:", err);
      activityStreamContainer.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--admin-rose);">
          Failed to load on-chain activities: ${err.message}
        </div>
      `;
    }
  }

  function getBadgeClass(actionType) {
    switch (actionType) {
      case "identity_created":
        return "badge-identity-created";
      case "identity_updated":
        return "badge-identity-updated";
      case "nft_minted":
        return "badge-nft-minted";
      case "role_assigned":
      case "access_granted":
        return "badge-role-assigned";
      case "access_denied":
      case "role_revoked":
        return "badge-access-denied";
      case "asset_transferred":
        return "badge-asset-transferred";
      default:
        return "badge-identity-created";
    }
  }

  function formatTimeAgo(isoString) {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const seconds = Math.floor((now - date) / 1000);

      if (seconds < 10) return "Just now";
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recent";
    }
  }

  function renderActivities() {
    const searchTerm = activitySearchInput.value.toLowerCase().trim();

    const filtered = allActivities.filter((act) => {
      // Filter by action pill
      if (currentFilter !== "all") {
        if (currentFilter === "role_assigned" && (act.actionType !== "role_assigned" && act.actionType !== "access_granted")) return false;
        if (currentFilter === "access_denied" && (act.actionType !== "access_denied" && act.actionType !== "role_revoked")) return false;
        if (currentFilter !== "role_assigned" && currentFilter !== "access_denied" && act.actionType !== currentFilter) return false;
      }

      // Filter by search text
      if (searchTerm) {
        const matchAction = act.action.toLowerCase().includes(searchTerm);
        const matchUser = (act.userName || "").toLowerCase().includes(searchTerm);
        const matchAddress = (act.userAddress || "").toLowerCase().includes(searchTerm);
        const matchDid = (act.didURI || "").toLowerCase().includes(searchTerm);
        const matchTx = (act.transactionHash || "").toLowerCase().includes(searchTerm);
        const matchBlock = `block #${act.blockNumber}`.toLowerCase().includes(searchTerm);
        const matchDetails = (act.details || "").toLowerCase().includes(searchTerm);
        return matchAction || matchUser || matchAddress || matchDid || matchTx || matchBlock || matchDetails;
      }

      return true;
    });

    if (filtered.length === 0) {
      activityStreamContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
          No matching blockchain activities found.
        </div>
      `;
      return;
    }

    activityStreamContainer.innerHTML = filtered
      .map((act) => {
        const badgeClass = getBadgeClass(act.actionType);
        const userDisplay = act.userName || "Verified Identity";
        const shortAddr = act.userAddress ? `${act.userAddress.slice(0, 6)}...${act.userAddress.slice(-4)}` : "--";
        const shortDid = act.didURI ? `${act.didURI.slice(0, 14)}...` : `did:ethr:${shortAddr}`;
        const shortTx = act.transactionHash ? `${act.transactionHash.slice(0, 8)}...` : "--";
        const timeAgo = formatTimeAgo(act.timestamp);

        return `
          <div class="activity-item-card" data-tx="${act.transactionHash}">
            <!-- Action -->
            <div>
              <span class="action-badge ${badgeClass}">
                <span class="pulse-dot" style="width: 5px; height: 5px;"></span>
                ${act.action}
              </span>
            </div>

            <!-- User Info / Name -->
            <div class="act-user-col">
              <span class="act-user-name">${userDisplay}</span>
              <span class="act-user-sub">${act.details || act.assetName || "On-Chain Activity"}</span>
            </div>

            <!-- Wallet / DID -->
            <div class="act-wallet-col">
              <span class="act-did-text" title="Click to copy DID" onclick="window.copyText('${act.didURI || `did:ethr:${act.userAddress}`}', 'DID')">
                ${shortDid}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </span>
              <span class="act-wallet-text mono" title="Wallet: ${act.userAddress}">${shortAddr}</span>
            </div>

            <!-- Block & Tx -->
            <div class="act-tx-col">
              <span class="act-block-badge">Block #${act.blockNumber}</span>
              <span class="act-tx-hash" title="Click to copy Tx Hash" onclick="window.copyText('${act.transactionHash}', 'Tx Hash')">
                Tx: ${shortTx}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </span>
            </div>

            <!-- Time -->
            <div class="act-time-col" title="${new Date(act.timestamp).toLocaleString()}">
              ${timeAgo}
            </div>

            <!-- Status -->
            <div class="act-status-col">
              <span class="status-badge-success">
                <span class="status-dot-sm"></span>
                Success
              </span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Expose copy helper to global window for inline onclicks
  window.copyText = copyToClipboard;

  // Filter Pills click listener
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.getAttribute("data-filter");
      renderActivities();
    });
  });

  // Search input listener
  activitySearchInput.addEventListener("input", renderActivities);

  // Copy Contract Chip
  contractChip.addEventListener("click", () => {
    if (fullContractAddress) {
      copyToClipboard(fullContractAddress, "Contract Address");
    }
  });

  // Manual Refresh
  btnManualRefresh.addEventListener("click", async () => {
    refreshIcon.classList.add("spinning");
    await Promise.all([loadAdminStats(), loadAdminActivities()]);
    setTimeout(() => refreshIcon.classList.remove("spinning"), 600);
    showToast("Dashboard synchronized with blockchain.");
  });

  // Auto-refresh interval (every 6 seconds)
  setInterval(() => {
    loadAdminStats();
    loadAdminActivities();
  }, 6000);

  // ==========================================
  // 4. Modal Management & Handlers
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

  // Close when clicking backdrop
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.remove("active");
    });
  });

  // Button: Register Identity
  btnActionRegister.addEventListener("click", () => {
    openModal("modalRegister");
  });

  // Button: Assign Role
  btnActionRole.addEventListener("click", () => {
    openModal("modalRole");
  });

  // Button: Mint Asset
  btnActionMint.addEventListener("click", () => {
    openModal("modalMint");
  });

  // Button: Manage Assets
  btnActionManageAssets.addEventListener("click", async () => {
    openModal("modalManageAssets");
    await loadAllAssetsInventory();
  });

  // Button: View Audit Trail
  btnActionAuditTrail.addEventListener("click", () => {
    openModal("modalAuditTrail");
    renderAuditTrailJson();
  });

  // Quick fill buttons inside modals
  document.querySelectorAll("[data-fill-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("modalRegAddress").value = btn.getAttribute("data-fill-modal");
    });
  });

  document.querySelectorAll("[data-fill-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("modalRoleAddress").value = btn.getAttribute("data-fill-role");
    });
  });

  document.querySelectorAll("[data-fill-mint]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("modalMintRecipient").value = btn.getAttribute("data-fill-mint");
    });
  });

  // ==========================================
  // 5. Form Submissions
  // ==========================================

  // 1. Admin Register Identity
  const adminRegisterForm = document.getElementById("adminRegisterForm");
  const btnSubmitAdminReg = document.getElementById("btnSubmitAdminReg");

  adminRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = document.getElementById("modalRegAddress").value.trim();
    const customDid = document.getElementById("modalRegCustomDid").value.trim();

    setLoading(btnSubmitAdminReg, true);

    try {
      const res = await fetch("/api/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, customDid: customDid || undefined }),
      });
      const data = await res.json();

      if (data.success) {
        showToast("DID successfully registered on-chain!");
        closeModal("modalRegister");
        adminRegisterForm.reset();
        await Promise.all([loadAdminStats(), loadAdminActivities()]);
      } else {
        showToast(data.error || "Failed to register identity", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnSubmitAdminReg, false);
    }
  });

  // 2. Admin Role Form
  const adminRoleForm = document.getElementById("adminRoleForm");
  const btnSubmitAdminRole = document.getElementById("btnSubmitAdminRole");

  adminRoleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = document.getElementById("modalRoleSelect").value;
    const account = document.getElementById("modalRoleAddress").value.trim();
    const actionType = document.querySelector('input[name="roleActionType"]:checked').value;

    setLoading(btnSubmitAdminRole, true);

    const endpoint = actionType === "grant" ? "/api/admin/roles/grant" : "/api/admin/roles/revoke";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, account }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || `Role action executed on-chain!`);
        closeModal("modalRole");
        adminRoleForm.reset();
        await Promise.all([loadAdminStats(), loadAdminActivities()]);
      } else {
        showToast(data.error || "Failed to update role", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnSubmitAdminRole, false);
    }
  });

  // 3. Admin Mint Form
  const adminMintForm = document.getElementById("adminMintForm");
  const btnSubmitAdminMint = document.getElementById("btnSubmitAdminMint");

  adminMintForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const to = document.getElementById("modalMintRecipient").value.trim();
    const assetType = document.getElementById("modalMintAssetType").value;
    const fullName = document.getElementById("modalMintFullName").value.trim();
    const identifier = document.getElementById("modalMintIdentifier").value.trim();
    const authority = document.getElementById("modalMintAuthority").value.trim();

    setLoading(btnSubmitAdminMint, true);

    const details = {
      fullName,
      credentialNumber: identifier,
      issuingAuthority: authority,
      issueDate: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch("/api/assets/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, assetType, details }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Minted NFT #${data.data.tokenId} to recipient!`);
        closeModal("modalMint");
        adminMintForm.reset();
        await Promise.all([loadAdminStats(), loadAdminActivities()]);
      } else {
        showToast(data.error || "Failed to mint NFT", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnSubmitAdminMint, false);
    }
  });

  // Helper for Role Holders Display
  function updateRoleHoldersDisplay(roleHolders) {
    const container = document.getElementById("roleHoldersSummary");
    if (!container || !roleHolders) return;

    let html = "";
    for (const [roleName, accounts] of Object.entries(roleHolders)) {
      html += `
        <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="color: var(--secondary); font-weight: 600; margin-bottom: 2px;">${roleName} (${accounts.length})</div>
          <div style="color: var(--text-muted); font-size: 0.75rem;">${accounts.length > 0 ? accounts.join(", ") : "None assigned"}</div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // Helper for Asset Inventory
  async function loadAllAssetsInventory() {
    const gallery = document.getElementById("adminAssetsGallery");
    gallery.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">Fetching on-chain NFT assets...</div>`;

    try {
      const res = await fetch("/api/admin/assets");
      const data = await res.json();

      if (data.success) {
        allAssets = data.assets;
        if (allAssets.length === 0) {
          gallery.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No NFT assets minted yet.</div>`;
          return;
        }

        gallery.innerHTML = allAssets
          .map((asset) => {
            const meta = asset.metadata || {};
            const name = meta.name || `Asset #${asset.tokenId}`;
            const type = meta.assetType || "Credential";
            const recipient = asset.owner;
            const shortOwner = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;

            return `
              <div style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="act-block-badge">Token #${asset.tokenId}</span>
                  <span class="action-badge badge-nft-minted" style="font-size: 0.7rem;">${type}</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">${name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">Owner: ${shortOwner}</div>
                <button class="chip-btn" style="width: fit-content; margin-top: 4px;" onclick="window.copyText('${asset.tokenURI || ""}', 'Token URI')">Copy Token URI</button>
              </div>
            `;
          })
          .join("");
      }
    } catch (err) {
      gallery.innerHTML = `<div style="grid-column: 1/-1; color: var(--admin-rose); text-align: center;">Error: ${err.message}</div>`;
    }
  }

  // Helper for Audit Trail JSON
  function renderAuditTrailJson() {
    const container = document.getElementById("auditTrailDetailsContainer");
    container.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-all; margin: 0;">${JSON.stringify(
      allActivities,
      null,
      2
    )}</pre>`;
  }

  document.getElementById("btnExportAuditJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(allActivities, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aetherid-blockchain-audit-${Date.now()}.json`;
    a.click();
    showToast("Audit trail JSON downloaded.");
  });

  function setLoading(btn, isLoading) {
    const textSpan = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".spinner");
    if (isLoading) {
      btn.disabled = true;
      if (textSpan) textSpan.style.opacity = "0.5";
      if (spinner) spinner.style.display = "inline-block";
    } else {
      btn.disabled = false;
      if (textSpan) textSpan.style.opacity = "1";
      if (spinner) spinner.style.display = "none";
    }
  }

  // Initial Load
  loadAdminStats();
  loadAdminActivities();
});
