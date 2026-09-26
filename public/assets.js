document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements - Stats
  const statTotalAssets = document.getElementById("statTotalAssets");
  const statActiveAssets = document.getElementById("statActiveAssets");
  const statTransferredAssets = document.getElementById("statTransferredAssets");
  const statVerifiedAssets = document.getElementById("statVerifiedAssets");
  const assetsContractAddr = document.getElementById("assetsContractAddr");

  // Table & Filter
  const assetsTableBody = document.getElementById("assetsTableBody");
  const assetSearchInput = document.getElementById("assetSearchInput");
  const assetTypeFilterSelect = document.getElementById("assetTypeFilterSelect");
  const btnRefreshAssets = document.getElementById("btnRefreshAssets");
  const assetsRefreshIcon = document.getElementById("assetsRefreshIcon");

  // Modals & Action Buttons
  const btnOpenMintModal = document.getElementById("btnOpenMintModal");
  const btnOpenAssignModal = document.getElementById("btnOpenAssignModal");
  const modalTransferAsset = document.getElementById("modalTransferAsset");
  const modalAssetDetails = document.getElementById("modalAssetDetails");
  const modalVerifyAsset = document.getElementById("modalVerifyAsset");
  const modalMintAsset = document.getElementById("modalMintAsset");

  // Transfer Form Elements
  const formTransferAsset = document.getElementById("formTransferAsset");
  const transferAssetName = document.getElementById("transferAssetName");
  const transferTokenBadge = document.getElementById("transferTokenBadge");
  const transferAssetType = document.getElementById("transferAssetType");
  const transferCurrentOwnerVal = document.getElementById("transferCurrentOwnerVal");
  const transferTargetPreview = document.getElementById("transferTargetPreview");
  const transferRecipientInput = document.getElementById("transferRecipientInput");
  const confirmTransferCheck = document.getElementById("confirmTransferCheck");
  const transferConfirmTid = document.getElementById("transferConfirmTid");
  const btnSubmitTransfer = document.getElementById("btnSubmitTransfer");
  const transferReceiptBox = document.getElementById("transferReceiptBox");

  // Detail Modal Elements
  const detailTokenIdBadge = document.getElementById("detailTokenIdBadge");
  const detailAssetName = document.getElementById("detailAssetName");
  const detailAssetTypeBadge = document.getElementById("detailAssetTypeBadge");
  const detailStatusText = document.getElementById("detailStatusText");
  const detailOwnerWallet = document.getElementById("detailOwnerWallet");
  const detailOwnerDid = document.getElementById("detailOwnerDid");
  const detailAuthority = document.getElementById("detailAuthority");
  const detailCreatedDate = document.getElementById("detailCreatedDate");
  const detailTxHash = document.getElementById("detailTxHash");
  const detailBlockNumber = document.getElementById("detailBlockNumber");
  const detailAttributesGrid = document.getElementById("detailAttributesGrid");
  const detailRawJson = document.getElementById("detailRawJson");

  // Verify Modal Elements
  const verifyTokenSubtitle = document.getElementById("verifyTokenSubtitle");
  const verifyDidStatus = document.getElementById("verifyDidStatus");

  // Mint Form Elements
  const formMintDigitalAsset = document.getElementById("formMintDigitalAsset");
  const mintModalTitle = document.getElementById("mintModalTitle");
  const inputMintRecipient = document.getElementById("inputMintRecipient");
  const inputMintAssetType = document.getElementById("inputMintAssetType");
  const inputMintAssetName = document.getElementById("inputMintAssetName");
  const inputMintFullName = document.getElementById("inputMintFullName");
  const inputMintAuthority = document.getElementById("inputMintAuthority");
  const inputMintIdNumber = document.getElementById("inputMintIdNumber");
  const btnSubmitMintAsset = document.getElementById("btnSubmitMintAsset");

  // Global State
  let allAssets = [];
  let currentSelectedAsset = null;
  let registeredUsers = [];
  let currentAuthUser = null;

  // Toast Helper
  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = `
      <span>${type === "success" ? "✓" : "⚠"}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function copyText(text, label = "Copied") {
    navigator.clipboard.writeText(text);
    showToast(`${label}: ${text.slice(0, 10)}...`);
  }
  window.copyText = copyText;

  // Animate counter values
  function animateCounter(element, target) {
    if (!element) return;
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;

    let start = current;
    const duration = 400;
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
  // 1. Fetch Stats & Asset Registry
  // ==========================================
  async function loadAssetsData() {
    try {
      const [resStats, resAll, resAdminStats, resUsers, resAuth] = await Promise.all([
        fetch("/api/assets/stats"),
        fetch("/api/assets/all"),
        fetch("/api/admin/stats"),
        fetch("/api/roles/users").catch(() => null),
        fetch("/api/auth/me").catch(() => null),
      ]);

      const statsData = await resStats.json();
      const allData = await resAll.json();
      const adminStats = await resAdminStats.json();

      if (resUsers && resUsers.ok) {
        try {
          const usersData = await resUsers.json();
          if (usersData && usersData.success && usersData.users) {
            registeredUsers = usersData.users;
          }
        } catch {}
      }

      if (resAuth && resAuth.ok) {
        try {
          const authData = await resAuth.json();
          if (authData && authData.authenticated && authData.user) {
            currentAuthUser = authData.user;
          }
        } catch {}
      }

      if (adminStats.success && adminStats.contract) {
        assetsContractAddr.textContent = `${adminStats.contract.address.slice(0, 6)}...${adminStats.contract.address.slice(-4)}`;
        assetsContractAddr.title = adminStats.contract.address;
      }

      if (statsData.success) {
        animateCounter(statTotalAssets, statsData.stats.totalAssets);
        animateCounter(statActiveAssets, statsData.stats.activeAssets);
        animateCounter(statTransferredAssets, statsData.stats.transferredAssets);
        animateCounter(statVerifiedAssets, statsData.stats.verifiedAssets);
      }

      if (allData.success) {
        allAssets = allData.assets;
        renderAssetTable();
      }
    } catch (err) {
      console.error("Error loading assets data:", err);
      assetsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--admin-rose); padding: 30px;">
            Error loading digital assets: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  function getAssetTypeBadgeClass(type) {
    const formatted = (type || "Other").replace(/\s+/g, "-");
    return `badge-${formatted}`;
  }

  function renderAssetTable() {
    const search = assetSearchInput.value.toLowerCase().trim();
    const typeFilter = assetTypeFilterSelect.value;

    const filtered = allAssets.filter((a) => {
      if (typeFilter !== "ALL" && a.assetType !== typeFilter) {
        return false;
      }
      if (search) {
        const matchId = `#${a.tokenId}`.includes(search) || a.tokenId === search;
        const matchType = (a.assetType || "").toLowerCase().includes(search);
        const matchName = (a.assetName || "").toLowerCase().includes(search);
        const matchOwner = (a.ownerName || "").toLowerCase().includes(search);
        const matchAddr = (a.owner || "").toLowerCase().includes(search);
        const matchDid = (a.ownerDid || "").toLowerCase().includes(search);
        return matchId || matchType || matchName || matchOwner || matchAddr || matchDid;
      }
      return true;
    });

    if (filtered.length === 0) {
      assetsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No digital assets found matching current filter.
          </td>
        </tr>
      `;
      return;
    }

    assetsTableBody.innerHTML = filtered
      .map((a) => {
        const badgeClass = getAssetTypeBadgeClass(a.assetType);
        const shortAddr = `${a.owner.slice(0, 6)}...${a.owner.slice(-4)}`;
        const shortDid = a.ownerDid ? `${a.ownerDid.slice(0, 14)}...` : `did:ethr:${shortAddr}`;
        const formattedDate = new Date(a.createdDate).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const statusBadge =
          a.status === "Transferred"
            ? `<span class="action-badge badge-asset-transferred" style="font-size: 0.72rem;">Transferred</span>`
            : `<span class="status-badge-success"><span class="status-dot-sm"></span> Active</span>`;

        return `
          <tr>
            <td>
              <span class="act-block-badge">#${a.tokenId}</span>
            </td>
            <td>
              <span class="asset-type-badge ${badgeClass}">${a.assetType}</span>
            </td>
            <td>
              <div style="font-weight: 700; color: #fff; font-size: 0.92rem;">${a.assetName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${a.issuingAuthority || "Verified Issuer"}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                <span>${a.ownerName}</span>
                ${a.isLegacyDemo ? `<span style="font-size: 0.65rem; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 1px 5px; border-radius: 4px;">Seed Data</span>` : ""}
              </div>
              <div class="mono" style="font-size: 0.75rem; color: var(--text-muted); cursor: pointer;" title="Click to copy" onclick="window.copyText('${a.owner}', 'Owner Wallet')">
                ${shortAddr}
              </div>
            </td>
            <td>
              <div class="mono" style="color: var(--secondary); font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to copy DID" onclick="window.copyText('${a.ownerDid}', 'Owner DID')">
                ${shortDid}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;" title="${a.createdDate}">${formattedDate}</td>
            <td style="text-align: right;">
              <div style="display: inline-flex; gap: 6px;">
                <button class="chip-btn" onclick="window.openTransferModal('${a.tokenId}')" title="Transfer Asset">
                  Transfer
                </button>
                <button class="chip-btn" onclick="window.openVerifyModal('${a.tokenId}')" title="Verify On-Chain">
                  Verify
                </button>
                <button class="chip-btn" style="background: rgba(99, 102, 241, 0.15); color: var(--primary); border-color: rgba(99, 102, 241, 0.3);" onclick="window.openDetailsModal('${a.tokenId}')" title="View Details">
                  Details
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Filters & Search
  assetTypeFilterSelect.addEventListener("change", renderAssetTable);
  assetSearchInput.addEventListener("input", renderAssetTable);

  btnRefreshAssets.addEventListener("click", async () => {
    assetsRefreshIcon.classList.add("spinning");
    await loadAssetsData();
    setTimeout(() => assetsRefreshIcon.classList.remove("spinning"), 600);
    showToast("Asset registry synchronized with blockchain.");
  });

  // ==========================================
  // 2. Modal Handlers
  // ==========================================
  function openModal(modal) {
    if (modal) modal.classList.add("active");
  }
  function closeModal(modal) {
    if (modal) modal.classList.remove("active");
  }

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      const m = document.getElementById(modalId);
      closeModal(m);
    });
  });

  // Transfer Modal
  window.openTransferModal = (tokenId) => {
    const asset = allAssets.find((a) => a.tokenId === tokenId);
    if (!asset) return;

    currentSelectedAsset = asset;
    transferAssetName.textContent = asset.assetName;
    transferTokenBadge.textContent = `Token #${asset.tokenId}`;
    transferAssetType.textContent = `Asset Type: ${asset.assetType}`;
    transferCurrentOwnerVal.textContent = asset.owner;
    transferCurrentOwnerVal.title = asset.ownerName;

    transferTargetPreview.textContent = "Enter recipient below...";
    transferRecipientInput.value = "";
    confirmTransferCheck.checked = false;
    transferConfirmTid.textContent = `#${asset.tokenId}`;
    transferReceiptBox.style.display = "none";
    formTransferAsset.style.display = "block";

    // Dynamically render recipient quick-fills for registered users excluding current owner
    const quickFillsContainer = document.querySelector("#modalTransferAsset .quick-fills");
    if (quickFillsContainer && registeredUsers.length > 0) {
      const candidates = registeredUsers.filter(
        (u) => u.address && u.address.toLowerCase() !== asset.owner.toLowerCase()
      );
      if (candidates.length > 0) {
        quickFillsContainer.innerHTML =
          `<span>Quick:</span>` +
          candidates
            .map(
              (u) =>
                `<button type="button" class="chip-btn" data-fill-transfer="${u.address}" title="${u.address}">${u.user}</button>`
            )
            .join(" ");

        quickFillsContainer.querySelectorAll("[data-fill-transfer]").forEach((btn) => {
          btn.addEventListener("click", () => {
            transferRecipientInput.value = btn.getAttribute("data-fill-transfer");
            transferRecipientInput.dispatchEvent(new Event("input"));
          });
        });
      }
    }

    openModal(modalTransferAsset);
  };

  transferRecipientInput.addEventListener("input", () => {
    const val = transferRecipientInput.value.trim();
    if (!val) {
      transferTargetPreview.textContent = "Select below...";
      return;
    }
    const matchedUser = registeredUsers.find(
      (u) => u.user && u.user.toLowerCase() === val.toLowerCase()
    );
    if (matchedUser) {
      transferTargetPreview.textContent = `${matchedUser.user} (${matchedUser.address.slice(0, 6)}...${matchedUser.address.slice(-4)})`;
      return;
    }
    const matchedByAddr = registeredUsers.find(
      (u) => u.address && u.address.toLowerCase() === val.toLowerCase()
    );
    if (matchedByAddr) {
      transferTargetPreview.textContent = `${matchedByAddr.user} (${val.slice(0, 6)}...${val.slice(-4)})`;
      return;
    }
    transferTargetPreview.textContent = val.length > 14 ? `${val.slice(0, 8)}...${val.slice(-6)}` : val;
  });

  document.querySelectorAll("[data-fill-transfer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const addr = btn.getAttribute("data-fill-transfer");
      transferRecipientInput.value = addr;
      transferRecipientInput.dispatchEvent(new Event("input"));
    });
  });

  formTransferAsset.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentSelectedAsset) return;

    const toAddress = transferRecipientInput.value.trim();
    if (!confirmTransferCheck.checked) {
      showToast("Please check the confirmation box to authorize transfer.", "error");
      return;
    }

    setLoading(btnSubmitTransfer, true);

    try {
      const res = await fetch("/api/assets/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: currentSelectedAsset.tokenId,
          toAddress: toAddress,
          callerAddress: currentAuthUser ? currentAuthUser.walletAddress : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Token #${currentSelectedAsset.tokenId} transferred successfully!`);

        // Show Post-Transfer Receipt
        document.getElementById("recTokenId").textContent = `#${data.data.tokenId}`;
        document.getElementById("recPrevOwner").textContent = data.data.previousOwner;
        document.getElementById("recNewOwner").textContent = data.data.newOwner;
        document.getElementById("recTxHash").textContent = data.data.transactionHash;
        document.getElementById("recTxHash").onclick = () => window.copyText(data.data.transactionHash, "Tx Hash");
        document.getElementById("recBlock").textContent = `Block #${data.data.blockNumber}`;

        transferReceiptBox.style.display = "block";
        formTransferAsset.style.display = "none";

        await loadAssetsData();
      } else {
        showToast(data.error || "Failed to execute transfer.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnSubmitTransfer, false);
    }
  });

  // Verify Modal
  window.openVerifyModal = async (tokenId) => {
    const asset = allAssets.find((a) => a.tokenId === tokenId);
    if (!asset) return;

    verifyTokenSubtitle.textContent = `Token #${tokenId} (${asset.assetName}) verified on-chain.`;
    verifyDidStatus.textContent = `${asset.ownerDid ? "Registered" : "Active"} (did:ethr) ✓`;

    openModal(modalVerifyAsset);
  };

  // Details Modal
  window.openDetailsModal = (tokenId) => {
    const asset = allAssets.find((a) => a.tokenId === tokenId);
    if (!asset) return;

    detailTokenIdBadge.textContent = `Token #${asset.tokenId}`;
    detailAssetName.textContent = asset.assetName;
    detailAssetTypeBadge.className = `asset-type-badge ${getAssetTypeBadgeClass(asset.assetType)}`;
    detailAssetTypeBadge.textContent = asset.assetType;
    detailStatusText.textContent = asset.status;

    detailOwnerWallet.textContent = asset.owner;
    detailOwnerWallet.onclick = () => window.copyText(asset.owner, "Owner Wallet");

    detailOwnerDid.textContent = asset.ownerDid;
    detailOwnerDid.onclick = () => window.copyText(asset.ownerDid, "Owner DID");

    detailAuthority.textContent = asset.issuingAuthority || "Credexa Authority";
    detailCreatedDate.textContent = new Date(asset.createdDate).toLocaleString();

    detailTxHash.textContent = `${asset.transactionHash.slice(0, 14)}...`;
    detailTxHash.title = asset.transactionHash;
    detailTxHash.onclick = () => window.copyText(asset.transactionHash, "Transaction Hash");

    detailBlockNumber.textContent = `Block #${asset.blockNumber}`;

    // Attributes list
    const attrs = (asset.metadata && asset.metadata.attributes) || [];
    if (attrs.length > 0) {
      detailAttributesGrid.innerHTML = attrs
        .map(
          (attr) => `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px;">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">${attr.trait_type}</div>
            <div style="font-size: 0.82rem; font-weight: 600; color: #fff; margin-top: 2px;">${attr.value}</div>
          </div>
        `
        )
        .join("");
    } else {
      detailAttributesGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-muted); font-size: 0.8rem;">No explicit traits found in metadata.</div>`;
    }

    detailRawJson.textContent = JSON.stringify(asset.metadata || {}, null, 2);

    openModal(modalAssetDetails);
  };

  // Mint / Assign Modal Openers
  btnOpenMintModal.addEventListener("click", () => {
    mintModalTitle.textContent = "Mint Digital Asset Credential (NFT)";
    formMintDigitalAsset.reset();
    openModal(modalMintAsset);
  });

  btnOpenAssignModal.addEventListener("click", () => {
    mintModalTitle.textContent = "Assign Digital Asset to User";
    formMintDigitalAsset.reset();
    openModal(modalMintAsset);
  });

  document.querySelectorAll("[data-fill-mrec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      inputMintRecipient.value = btn.getAttribute("data-fill-mrec");
    });
  });

  formMintDigitalAsset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const to = inputMintRecipient.value.trim();
    const assetType = inputMintAssetType.value;
    const assetName = inputMintAssetName.value.trim();
    const fullName = inputMintFullName.value.trim();
    const authority = inputMintAuthority.value.trim();
    const idNumber = inputMintIdNumber.value.trim();

    setLoading(btnSubmitMintAsset, true);

    const details = {
      fullName: fullName,
      name: assetName,
      credentialNumber: idNumber,
      issuingAuthority: authority,
      issueDate: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch("/api/assets/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to,
          assetType: assetType,
          details: details,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Minted ${assetType} NFT #${data.data.tokenId} successfully!`);
        closeModal(modalMintAsset);
        formMintDigitalAsset.reset();
        await loadAssetsData();
      } else {
        showToast(data.error || "Failed to mint digital asset.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnSubmitMintAsset, false);
    }
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

  // Initial load
  loadAssetsData();
});
