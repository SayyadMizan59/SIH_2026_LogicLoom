document.addEventListener("DOMContentLoaded", () => {
  // Preset Users
  const DEMO_USERS = [
    {
      name: "Mizan",
      role: "USER",
      roleBadge: "badge-user",
      address: "0xc8Cd9300c0174353255140EEB9E3864a7541D99c",
      did: "did:ethr:0xc8Cd9300c0174353255140EEB9E3864a7541D99c",
      desc: "Standard Developer / Identity Holder",
    },
    {
      name: "Rahul",
      role: "MANAGER",
      roleBadge: "badge-manager",
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      did: "did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      desc: "Engineering Manager (Authorized to Mint/Manage Assets)",
    },
    {
      name: "Priya",
      role: "AUDITOR",
      roleBadge: "badge-auditor",
      address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      did: "did:ethr:0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      desc: "Security Auditor (Authorized for Compliance Logs)",
    },
    {
      name: "System Admin",
      role: "ADMIN",
      roleBadge: "badge-admin",
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      did: "did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      desc: "Default Administrator (Full System Clearance)",
    },
    {
      name: "David K.",
      role: "USER",
      roleBadge: "badge-user",
      address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      did: "did:ethr:0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      desc: "Registered End-User",
    },
  ];

  // Preset Assets
  const DEMO_ASSETS = [
    {
      id: "asset-confidential-doc",
      name: "Company Confidential Document",
      type: "Company Document",
      requiredRole: "ADMIN",
      badgeColor: "#f43f5e",
      desc: "Top-secret internal strategic blueprint and merger financials.",
    },
    {
      id: "asset-software-license",
      name: "Company Software License",
      type: "Software License",
      requiredRole: "MANAGER",
      badgeColor: "#a855f7",
      desc: "Enterprise tier API keys, production license credentials & cloud access.",
    },
    {
      id: "asset-intellectual-property",
      name: "Intellectual Property & Algorithm Source",
      type: "Intellectual Property",
      requiredRole: "MANAGER",
      badgeColor: "#ec4899",
      desc: "Patented zero-knowledge cryptographic proof generation routines.",
    },
    {
      id: "asset-auditor-dossier",
      name: "Compliance & Audit Dossier",
      type: "Digital Certificate",
      requiredRole: "AUDITOR",
      badgeColor: "#06b6d4",
      desc: "Comprehensive financial audit logs & smart contract verification proofs.",
    },
    {
      id: "asset-driving-license",
      name: "Personal Driving License #DL-NY-2026",
      type: "Driving License",
      requiredRole: "USER",
      badgeColor: "#10b981",
      desc: "Government-issued digital driving credential verified on-chain.",
    },
    {
      id: "asset-university-degree",
      name: "University Degree Credential (B.Sc.)",
      type: "Educational Certificate",
      requiredRole: "USER",
      badgeColor: "#3b82f6",
      desc: "Cryptographically certified Bachelor of Science degree diploma.",
    },
  ];

  // DOM Elements
  const userSelectionGrid = document.getElementById("userSelectionGrid");
  const assetSelectionGrid = document.getElementById("assetSelectionGrid");
  const btnRunPipeline = document.getElementById("btnRunPipeline");
  const demoContractAddr = document.getElementById("demoContractAddr");

  // Pipeline Step Elements
  const outStep1 = document.getElementById("outStep1");
  const outStep1Desc = document.getElementById("outStep1Desc");
  const outStep1Status = document.getElementById("outStep1Status");

  const outStep2 = document.getElementById("outStep2");
  const outStep2Desc = document.getElementById("outStep2Desc");
  const outStep2Status = document.getElementById("outStep2Status");

  const outStep3 = document.getElementById("outStep3");
  const outStep3Desc = document.getElementById("outStep3Desc");
  const outStep3Status = document.getElementById("outStep3Status");

  const outStep4 = document.getElementById("outStep4");
  const outStep4Desc = document.getElementById("outStep4Desc");
  const outStep4Status = document.getElementById("outStep4Status");

  const outDecisionCard = document.getElementById("outDecisionCard");
  const outDecisionTitle = document.getElementById("outDecisionTitle");
  const outDecisionBadge = document.getElementById("outDecisionBadge");
  const outDecisionReason = document.getElementById("outDecisionReason");

  const outAuditBox = document.getElementById("outAuditBox");
  const outAuditBlock = document.getElementById("outAuditBlock");
  const outAuditTx = document.getElementById("outAuditTx");
  const outAuditContract = document.getElementById("outAuditContract");
  const outAuditTime = document.getElementById("outAuditTime");

  // Preset Scenario Buttons
  const presetScenario1 = document.getElementById("presetScenario1");
  const presetScenario2 = document.getElementById("presetScenario2");
  const presetScenario3 = document.getElementById("presetScenario3");

  // State
  let selectedUser = DEMO_USERS[0];
  let selectedAsset = DEMO_ASSETS[0];

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

  // Render User Selection Cards
  function renderUserCards() {
    userSelectionGrid.innerHTML = DEMO_USERS.map(
      (u, idx) => `
      <div class="selection-card ${u.address === selectedUser.address ? "selected" : ""}" data-user-idx="${idx}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="color: #fff; font-size: 0.95rem;">${u.name}</strong>
          <span class="role-badge ${u.roleBadge}" style="font-size: 0.7rem;">${u.role}</span>
        </div>
        <div class="mono" style="font-size: 0.72rem; color: var(--secondary);">${u.did.slice(0, 16)}...</div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">${u.desc}</div>
      </div>
    `
    ).join("");

    document.querySelectorAll("[data-user-idx]").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.getAttribute("data-user-idx"));
        selectedUser = DEMO_USERS[idx];
        renderUserCards();
      });
    });
  }

  // Render Asset Selection Cards
  function renderAssetCards() {
    assetSelectionGrid.innerHTML = DEMO_ASSETS.map(
      (a, idx) => `
      <div class="selection-card ${a.id === selectedAsset.id ? "selected" : ""}" data-asset-idx="${idx}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <strong style="color: #fff; font-size: 0.88rem;">${a.name}</strong>
          <span class="act-block-badge" style="font-size: 0.68rem; color: ${a.badgeColor};">${a.requiredRole} Req</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--primary); font-weight: 500;">${a.type}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">${a.desc}</div>
      </div>
    `
    ).join("");

    document.querySelectorAll("[data-asset-idx]").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.getAttribute("data-asset-idx"));
        selectedAsset = DEMO_ASSETS[idx];
        renderAssetCards();
      });
    });
  }

  // Preset Scenario Handlers
  presetScenario1.addEventListener("click", () => {
    selectedUser = DEMO_USERS.find((u) => u.name === "Mizan");
    selectedAsset = DEMO_ASSETS.find((a) => a.id === "asset-confidential-doc");
    renderUserCards();
    renderAssetCards();
    runAccessPipeline();
  });

  presetScenario2.addEventListener("click", () => {
    selectedUser = DEMO_USERS.find((u) => u.name === "Rahul");
    selectedAsset = DEMO_ASSETS.find((a) => a.id === "asset-software-license");
    renderUserCards();
    renderAssetCards();
    runAccessPipeline();
  });

  presetScenario3.addEventListener("click", () => {
    selectedUser = DEMO_USERS.find((u) => u.name === "Priya");
    selectedAsset = DEMO_ASSETS.find((a) => a.id === "asset-auditor-dossier");
    renderUserCards();
    renderAssetCards();
    runAccessPipeline();
  });

  // Run Access Control Pipeline
  async function runAccessPipeline() {
    setLoading(btnRunPipeline, true);

    // Reset UI state
    document.querySelectorAll(".pipe-node").forEach((node) => {
      node.className = "pipe-node";
    });
    document.getElementById("pipeNode1").classList.add("success");

    outStep1Desc.textContent = `Querying on-chain DID for ${selectedUser.name}...`;
    outStep1Status.textContent = "Checking...";
    outStep1Status.style.color = "var(--text-muted)";

    outStep2Desc.textContent = "Querying AccessControl smart contract roles...";
    outStep2Status.textContent = "Checking...";

    outStep3Desc.textContent = `Analyzing security clearance for ${selectedAsset.name}...`;
    outStep3Status.textContent = "Analyzing...";

    outStep4Desc.textContent = "Evaluating RBAC permission matrix...";
    outStep4Status.textContent = "Evaluating...";

    outDecisionCard.style.display = "none";
    outAuditBox.style.display = "none";

    try {
      // Execute pipeline request
      const res = await fetch("/api/demo/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: selectedUser.address,
          assetId: selectedAsset.id,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Access pipeline request failed.");
      }

      const p = data.pipeline;

      // Animate Step 1: DID Verification
      await delay(250);
      document.getElementById("pipeNode2").classList.add("success");
      outStep1Desc.textContent = `${p.step1_did.statusText} (${p.user.did})`;
      outStep1Status.textContent = "Verified ✓";
      outStep1Status.style.color = "var(--success)";

      // Animate Step 2: Role Retrieval
      await delay(250);
      document.getElementById("pipeNode3").classList.add("success");
      outStep2Desc.textContent = `Smart Contract RBAC: On-Chain Role = ${p.step2_role.role}`;
      outStep2Status.textContent = `${p.step2_role.role} ✓`;
      outStep2Status.style.color = "var(--primary)";

      // Animate Step 3: Asset Identification
      await delay(250);
      document.getElementById("pipeNode4").classList.add("success");
      outStep3Desc.textContent = `${p.asset.classification}`;
      outStep3Status.textContent = `Required: ${p.asset.requiredRole}`;
      outStep3Status.style.color = "var(--secondary)";

      // Animate Step 4 & 5: Permission & Decision
      await delay(300);
      const isGranted = p.step5_decision.isGranted;

      if (isGranted) {
        document.getElementById("pipeNode5").classList.add("success");
        document.getElementById("pipeNode6").classList.add("success");

        outStep4Desc.textContent = p.step4_permission.reason;
        outStep4Status.textContent = "ALLOWED ✓";
        outStep4Status.style.color = "var(--success)";

        outDecisionCard.className = "decision-card decision-granted";
        outDecisionTitle.textContent = "✅ ACCESS GRANTED";
        outDecisionTitle.style.color = "var(--success)";
        outDecisionBadge.textContent = "AUTHORIZED";
        outDecisionBadge.style.color = "var(--success)";
        outDecisionReason.textContent = p.step4_permission.reason;
        outDecisionCard.style.display = "block";
      } else {
        document.getElementById("pipeNode5").classList.add("danger");
        document.getElementById("pipeNode6").classList.add("danger");

        outStep4Desc.textContent = p.step4_permission.reason;
        outStep4Status.textContent = "NOT ALLOWED ✗";
        outStep4Status.style.color = "var(--admin-rose)";

        outDecisionCard.className = "decision-card decision-denied";
        outDecisionTitle.textContent = "❌ ACCESS DENIED";
        outDecisionTitle.style.color = "var(--admin-rose)";
        outDecisionBadge.textContent = "UNAUTHORIZED";
        outDecisionBadge.style.color = "var(--admin-rose)";
        outDecisionReason.textContent = p.step4_permission.reason;
        outDecisionCard.style.display = "block";
      }

      // Step 6: Audit receipt
      outAuditBlock.textContent = `Block #${p.step6_audit.blockNumber}`;
      outAuditTx.textContent = p.step6_audit.transactionHash;
      outAuditTx.onclick = () => window.copyText(p.step6_audit.transactionHash, "Audit Tx Hash");
      outAuditContract.textContent = p.step6_audit.contractAddress;
      outAuditTime.textContent = new Date(p.step6_audit.timestamp).toLocaleString();
      outAuditBox.style.display = "block";

      showToast(isGranted ? "Access Granted: Authorized by Smart Contract" : "Access Denied: Clearance Insufficient", isGranted ? "success" : "error");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnRunPipeline, false);
    }
  }

  btnRunPipeline.addEventListener("click", runAccessPipeline);

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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
  renderUserCards();
  renderAssetCards();
});
