document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Health / Status Elements
  const networkNameEl = document.getElementById("networkName");
  const relayerEthEl = document.getElementById("relayerEth");
  const contractAddressDisplayEl = document.getElementById("contractAddressDisplay");

  // Register Form Elements
  const registerForm = document.getElementById("registerForm");
  const regAddressInput = document.getElementById("regAddress");
  const regCustomDidInput = document.getElementById("regCustomDid");
  const regResultBox = document.getElementById("regResult");
  const btnSubmitRegister = document.getElementById("btnSubmitRegister");

  // Mint Form & Preview Elements
  const mintForm = document.getElementById("mintForm");
  const mintRecipientInput = document.getElementById("mintRecipient");
  const mintAssetTypeSelect = document.getElementById("mintAssetType");
  const mintFullNameInput = document.getElementById("mintFullName");
  const mintLicenseNumberInput = document.getElementById("mintLicenseNumber");
  const mintCategoryInput = document.getElementById("mintCategory");
  const mintIssueDateInput = document.getElementById("mintIssueDate");
  const mintExpiryDateInput = document.getElementById("mintExpiryDate");
  const mintAuthorityInput = document.getElementById("mintAuthority");
  const mintResultBox = document.getElementById("mintResult");
  const btnSubmitMint = document.getElementById("btnSubmitMint");

  // Card Preview Elements
  const previewAssetTypeEl = document.getElementById("previewAssetType");
  const previewFullNameEl = document.getElementById("previewFullName");
  const previewLicenseNumberEl = document.getElementById("previewLicenseNumber");
  const previewCategoryEl = document.getElementById("previewCategory");
  const previewExpiryEl = document.getElementById("previewExpiry");
  const previewAuthorityEl = document.getElementById("previewAuthority");
  const avatarImgEl = document.getElementById("avatarImg");

  // Verify Form Elements
  const verifyForm = document.getElementById("verifyForm");
  const verifyAddressInput = document.getElementById("verifyAddressInput");
  const btnSubmitVerify = document.getElementById("btnSubmitVerify");
  const verifyResultsContainer = document.getElementById("verifyResultsContainer");
  const verificationBadgeEl = document.getElementById("verificationBadge");
  const verificationTextEl = document.getElementById("verificationText");
  const assetCountPillEl = document.getElementById("assetCountPill");
  const verifyResultAddressEl = document.getElementById("verifyResultAddress");
  const verifyResultDidEl = document.getElementById("verifyResultDid");
  const verifyResultDateEl = document.getElementById("verifyResultDate");
  const assetsGridEl = document.getElementById("assetsGrid");

  // ==========================================
  // 1. Tab Switching
  // ==========================================
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.getAttribute("data-tab");

      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const activePane = document.getElementById(targetTabId);
      if (activePane) activePane.classList.add("active");
    });
  });

  // ==========================================
  // 2. Fetch System Health & Contract Status
  // ==========================================
  async function fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();

      if (data.status === "OK") {
        networkNameEl.textContent = `Hardhat (Chain ID ${data.network.chainId})`;
        relayerEthEl.textContent = `${parseFloat(data.relayer.balanceEth).toFixed(4)} ETH`;
        contractAddressDisplayEl.textContent = `${data.contractAddress.slice(0, 6)}...${data.contractAddress.slice(-4)}`;
        contractAddressDisplayEl.title = data.contractAddress;
      } else {
        networkNameEl.textContent = "Backend Offline / Not Configured";
      }
    } catch {
      networkNameEl.textContent = "Cannot connect to API";
    }
  }

  fetchHealth();
  setInterval(fetchHealth, 10000);

  // ==========================================
  // 3. Quick Fill Buttons
  // ==========================================
  document.querySelectorAll("[data-fill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const addr = btn.getAttribute("data-fill");
      regAddressInput.value = addr;
      mintRecipientInput.value = addr;
      updateCardPreview();
    });
  });

  document.querySelectorAll("[data-fill-verify]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const addr = btn.getAttribute("data-fill-verify");
      verifyAddressInput.value = addr;
      verifyForm.dispatchEvent(new Event("submit"));
    });
  });

  // ==========================================
  // 4. Live Card Preview Updater
  // ==========================================
  function updateCardPreview() {
    previewAssetTypeEl.textContent = mintAssetTypeSelect.value;
    previewFullNameEl.textContent = mintFullNameInput.value || "Credential Holder";
    previewLicenseNumberEl.textContent = `ID: ${mintLicenseNumberInput.value || "DL-0000"}`;
    previewCategoryEl.textContent = mintCategoryInput.value || "Class C";
    previewExpiryEl.textContent = mintExpiryDateInput.value || "2034-01-01";
    previewAuthorityEl.textContent = mintAuthorityInput.value || "Dept of Motor Vehicles";

    const recipient = mintRecipientInput.value.trim();
    if (recipient) {
      avatarImgEl.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(recipient)}`;
    }
  }

  [
    mintAssetTypeSelect,
    mintFullNameInput,
    mintLicenseNumberInput,
    mintCategoryInput,
    mintExpiryDateInput,
    mintAuthorityInput,
    mintRecipientInput,
  ].forEach((input) => {
    input.addEventListener("input", updateCardPreview);
  });

  // ==========================================
  // 5. Register Identity Submit
  // ==========================================
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = regAddressInput.value.trim();
    const customDid = regCustomDidInput.value.trim();

    setLoading(btnSubmitRegister, true);
    regResultBox.style.display = "none";

    try {
      const res = await fetch("/api/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, customDid: customDid || undefined }),
      });
      const data = await res.json();

      regResultBox.style.display = "block";
      if (res.ok && data.success) {
        regResultBox.className = "result-box success";
        regResultBox.innerHTML = `
          <strong>Success!</strong> ${data.message}<br/>
          <div style="margin-top: 6px;"><strong>DID:</strong> <code class="mono">${data.data.didURI}</code></div>
          <div><strong>Tx Hash:</strong> <code class="mono">${data.data.transactionHash}</code></div>
          <div><strong>Block:</strong> #${data.data.blockNumber} (Gas Used: ${data.data.gasUsed})</div>
        `;
        fetchHealth();
      } else {
        regResultBox.className = "result-box error";
        regResultBox.innerHTML = `<strong>Error:</strong> ${data.error || "Failed to register identity"}`;
      }
    } catch (err) {
      regResultBox.style.display = "block";
      regResultBox.className = "result-box error";
      regResultBox.innerHTML = `<strong>Network Error:</strong> ${err.message}`;
    } finally {
      setLoading(btnSubmitRegister, false);
    }
  });

  // ==========================================
  // 6. Mint Credential NFT Submit
  // ==========================================
  mintForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const to = mintRecipientInput.value.trim();
    const assetType = mintAssetTypeSelect.value;
    const details = {
      licenseNumber: mintLicenseNumberInput.value.trim(),
      fullName: mintFullNameInput.value.trim(),
      category: mintCategoryInput.value.trim(),
      issueDate: mintIssueDateInput.value,
      expiryDate: mintExpiryDateInput.value,
      issuingAuthority: mintAuthorityInput.value.trim(),
    };

    setLoading(btnSubmitMint, true);
    mintResultBox.style.display = "none";

    try {
      const res = await fetch("/api/assets/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, assetType, details }),
      });
      const data = await res.json();

      mintResultBox.style.display = "block";
      if (res.ok && data.success) {
        mintResultBox.className = "result-box success";
        mintResultBox.innerHTML = `
          <strong>Success!</strong> ${data.message}<br/>
          <div style="margin-top: 6px;"><strong>Token ID:</strong> #${data.data.tokenId}</div>
          <div><strong>Recipient:</strong> <code class="mono">${data.data.recipient}</code></div>
          <div><strong>Tx Hash:</strong> <code class="mono">${data.data.transactionHash}</code></div>
          <div><strong>Block:</strong> #${data.data.blockNumber}</div>
        `;
        fetchHealth();
      } else {
        mintResultBox.className = "result-box error";
        mintResultBox.innerHTML = `<strong>Error:</strong> ${data.error || "Failed to mint NFT"}`;
      }
    } catch (err) {
      mintResultBox.style.display = "block";
      mintResultBox.className = "result-box error";
      mintResultBox.innerHTML = `<strong>Network Error:</strong> ${err.message}`;
    } finally {
      setLoading(btnSubmitMint, false);
    }
  });

  // ==========================================
  // 7. Verify Credentials Lookup
  // ==========================================
  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = verifyAddressInput.value.trim();
    if (!address) return;

    setLoading(btnSubmitVerify, true);
    verifyResultsContainer.style.display = "none";
    assetsGridEl.innerHTML = "";

    try {
      const res = await fetch(`/api/verify/${address}`);
      const data = await res.json();

      if (res.ok && data.success) {
        verifyResultsContainer.style.display = "block";

        if (data.identity.exists) {
          verificationBadgeEl.style.borderColor = "var(--success)";
          verificationBadgeEl.style.background = "rgba(16, 185, 129, 0.15)";
          verificationBadgeEl.style.color = "var(--success)";
          verificationTextEl.textContent = "DID Registered & Valid";
        } else {
          verificationBadgeEl.style.borderColor = "#f59e0b";
          verificationBadgeEl.style.background = "rgba(245, 158, 11, 0.15)";
          verificationBadgeEl.style.color = "#f59e0b";
          verificationTextEl.textContent = "No DID Registered On-Chain";
        }

        assetCountPillEl.textContent = `${data.assetsCount} Digital Assets Owned`;
        verifyResultAddressEl.textContent = data.address;
        verifyResultDidEl.textContent = data.identity.didURI || "None";
        verifyResultDateEl.textContent = data.identity.createdAt
          ? new Date(data.identity.createdAt).toLocaleString()
          : "N/A";

        // Render Assets
        if (data.assets && data.assets.length > 0) {
          data.assets.forEach((asset) => {
            const card = document.createElement("div");
            card.className = "asset-card";

            const meta = asset.metadata || {};
            const attributesHtml =
              meta.attributes && Array.isArray(meta.attributes)
                ? meta.attributes
                    .map(
                      (attr) => `
                      <div class="attr-row">
                        <span class="attr-key">${attr.trait_type}:</span>
                        <span class="attr-val">${attr.value}</span>
                      </div>
                    `
                    )
                    .join("")
                : `<div class="attr-row"><span class="attr-key">Raw Data:</span><span class="attr-val">${JSON.stringify(meta)}</span></div>`;

            card.innerHTML = `
              <div class="asset-card-top">
                <span class="asset-token-id">Token #${asset.tokenId}</span>
                <span style="font-size: 0.75rem; color: var(--secondary);">${meta.assetType || "NFT Credential"}</span>
              </div>
              <div class="asset-title">${meta.name || `Credential #${asset.tokenId}`}</div>
              <div class="asset-desc">${meta.description || "On-chain verifiable credential NFT."}</div>
              <div class="asset-attributes">
                ${attributesHtml}
              </div>
            `;
            assetsGridEl.appendChild(card);
          });
        } else {
          assetsGridEl.innerHTML = `
            <div style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.2); border-radius: 8px;">
              No digital asset credentials minted for this address yet.
            </div>
          `;
        }
      } else {
        alert(data.error || "Failed to fetch verification info.");
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setLoading(btnSubmitVerify, false);
    }
  });

  // Helper
  function setLoading(btn, isLoading) {
    const textSpan = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".spinner");
    if (isLoading) {
      btn.disabled = true;
      if (textSpan) textSpan.style.opacity = "0.7";
      if (spinner) spinner.style.display = "inline-block";
    } else {
      btn.disabled = false;
      if (textSpan) textSpan.style.opacity = "1";
      if (spinner) spinner.style.display = "none";
    }
  }
});
