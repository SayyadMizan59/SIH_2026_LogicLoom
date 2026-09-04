document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const rolesTableBody = document.getElementById("rolesTableBody");
  const userCountBadge = document.getElementById("userCountBadge");
  const roleSearchInput = document.getElementById("roleSearchInput");
  const filterPills = document.querySelectorAll("[data-role-filter]");
  const btnRefreshRoles = document.getElementById("btnRefreshRoles");
  const rolesRefreshIcon = document.getElementById("rolesRefreshIcon");
  const rolesContractAddr = document.getElementById("rolesContractAddr");

  // Modal Elements
  const modalChangeRole = document.getElementById("modalChangeRole");
  const formChangeRole = document.getElementById("formChangeRole");
  const modalTargetUserName = document.getElementById("modalTargetUserName");
  const modalTargetAddress = document.getElementById("modalTargetAddress");
  const modalCurrentRoleBadge = document.getElementById("modalCurrentRoleBadge");
  const modalNewRoleSelect = document.getElementById("modalNewRoleSelect");
  const roleExplanationBox = document.getElementById("roleExplanationBox");
  const confirmRoleCheckbox = document.getElementById("confirmRoleCheckbox");
  const btnSubmitRoleChange = document.getElementById("btnSubmitRoleChange");

  // Simulator Elements
  const simForm = document.getElementById("simForm");
  const simCallerSelect = document.getElementById("simCallerSelect");
  const simActionSelect = document.getElementById("simActionSelect");
  const btnRunSim = document.getElementById("btnRunSim");
  const simResultContainer = document.getElementById("simResultContainer");

  // State
  let allUsers = [];
  let currentFilter = "ALL";
  let activeTargetUser = null;

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

  // Role Explanations
  const roleExplanations = {
    ADMIN: "Grants DEFAULT_ADMIN_ROLE & MANAGER_ROLE on-chain. Can grant/revoke all roles, mint NFTs, and register DIDs.",
    MANAGER: "Grants MANAGER_ROLE on-chain. Authorized to mint verifiable credential NFTs and register DIDs for users.",
    AUDITOR: "Grants AUDITOR_ROLE on-chain. Authorized for credential verification and audit trail inspection.",
    USER: "Revokes administrative privileges. Standard on-chain identity holder with self-registration permissions.",
  };

  modalNewRoleSelect.addEventListener("change", () => {
    const selected = modalNewRoleSelect.value;
    roleExplanationBox.textContent = roleExplanations[selected] || "";
  });

  // Fetch Users & Roles
  async function loadRolesData() {
    try {
      const [resRoles, resStats] = await Promise.all([
        fetch("/api/roles/users"),
        fetch("/api/admin/stats"),
      ]);

      const data = await resRoles.json();
      const statsData = await resStats.json();

      if (statsData.success && statsData.contract) {
        rolesContractAddr.textContent = `${statsData.contract.address.slice(0, 6)}...${statsData.contract.address.slice(-4)}`;
        rolesContractAddr.title = statsData.contract.address;
      }

      if (data.success) {
        allUsers = data.users;
        userCountBadge.textContent = `${allUsers.length} Users Tracked`;
        renderTable();
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
      rolesTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--admin-rose); padding: 30px;">
            Error loading user roles: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  function renderTable() {
    const search = roleSearchInput.value.toLowerCase().trim();

    const filtered = allUsers.filter((u) => {
      if (currentFilter !== "ALL" && u.role !== currentFilter) {
        return false;
      }
      if (search) {
        const matchName = u.user.toLowerCase().includes(search);
        const matchAddr = u.address.toLowerCase().includes(search);
        const matchDid = u.did.toLowerCase().includes(search);
        const matchRole = u.role.toLowerCase().includes(search);
        return matchName || matchAddr || matchDid || matchRole;
      }
      return true;
    });

    if (filtered.length === 0) {
      rolesTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No users found matching current filter.
          </td>
        </tr>
      `;
      return;
    }

    rolesTableBody.innerHTML = filtered
      .map((u) => {
        const shortAddr = `${u.address.slice(0, 6)}...${u.address.slice(-4)}`;
        const shortDid = u.did ? `${u.did.slice(0, 14)}...` : `did:ethr:${shortAddr}`;

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${u.user}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${u.hasIdentityOnChain ? "Identity Registered" : "Wallet Account"}</div>
            </td>
            <td>
              <div class="mono" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to copy" onclick="window.copyText('${u.address}', 'Address')">
                ${shortAddr}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            </td>
            <td>
              <div class="mono" style="color: var(--secondary); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to copy DID" onclick="window.copyText('${u.did}', 'DID')">
                ${shortDid}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            </td>
            <td>
              <span class="role-badge role-badge-${u.role}">
                ${u.role}
              </span>
            </td>
            <td>
              <span class="status-badge-success">
                <span class="status-dot-sm"></span>
                Active
              </span>
            </td>
            <td style="text-align: right;">
              <button class="btn-action" style="padding: 6px 12px; font-size: 0.8rem;" onclick="window.openChangeRoleModal('${u.address}')">
                Change Role
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Filter pills
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.getAttribute("data-role-filter");
      renderTable();
    });
  });

  // Search input
  roleSearchInput.addEventListener("input", renderTable);

  // Manual Refresh
  btnRefreshRoles.addEventListener("click", async () => {
    rolesRefreshIcon.classList.add("spinning");
    await loadRolesData();
    setTimeout(() => rolesRefreshIcon.classList.remove("spinning"), 600);
    showToast("Roles synchronized with blockchain.");
  });

  // Modal Open
  window.openChangeRoleModal = (address) => {
    const user = allUsers.find((u) => u.address.toLowerCase() === address.toLowerCase());
    if (!user) return;

    activeTargetUser = user;
    modalTargetUserName.textContent = user.user;
    modalTargetAddress.textContent = user.address;
    modalCurrentRoleBadge.className = `role-badge role-badge-${user.role}`;
    modalCurrentRoleBadge.textContent = user.role;

    modalNewRoleSelect.value = user.role;
    roleExplanationBox.textContent = roleExplanations[user.role] || "";
    confirmRoleCheckbox.checked = false;

    modalChangeRole.classList.add("active");
  };

  // Close Modal Handlers
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalChangeRole.classList.remove("active");
    });
  });
  modalChangeRole.addEventListener("click", (e) => {
    if (e.target === modalChangeRole) modalChangeRole.classList.remove("active");
  });

  // Submit Role Change
  formChangeRole.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeTargetUser) return;

    const newRole = modalNewRoleSelect.value;
    if (!confirmRoleCheckbox.checked) {
      showToast("Please check the confirmation box to proceed.", "error");
      return;
    }

    setLoading(btnSubmitRoleChange, true);

    try {
      const res = await fetch("/api/roles/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: activeTargetUser.address,
          newRole: newRole,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Role for ${activeTargetUser.user} updated to ${newRole} on-chain!`);
        modalChangeRole.classList.remove("active");
        await loadRolesData();
      } else {
        showToast(data.error || "Failed to change role.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(btnSubmitRoleChange, false);
    }
  });

  // ==========================================
  // RBAC Simulator Form
  // ==========================================
  simForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const callerAddress = simCallerSelect.value;
    const action = simActionSelect.value;

    setLoading(btnRunSim, true);
    simResultContainer.style.display = "none";

    try {
      const res = await fetch("/api/roles/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerAddress, action }),
      });

      const data = await res.json();

      simResultContainer.style.display = "block";

      if (data.authorized) {
        simResultContainer.innerHTML = `
          <div class="sim-result-banner sim-result-approved">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>✓ ACCESS GRANTED — Transaction Approved</strong>
              <span class="act-block-badge">Block #${data.blockNumber || "--"}</span>
            </div>
            <div>${data.message}</div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); opacity: 0.9;">Tx Hash: ${data.transactionHash || "--"}</div>
          </div>
        `;
        showToast("Simulation: Access Granted on blockchain!");
      } else {
        simResultContainer.innerHTML = `
          <div class="sim-result-banner sim-result-denied">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>✗ ACCESS DENIED — Smart Contract Revert</strong>
              <span class="role-badge role-badge-USER" style="color: #fecdd3; border-color: rgba(244,63,94,0.4);">REVERTED</span>
            </div>
            <div>${data.message}</div>
            <div style="font-size: 0.8rem; font-family: var(--font-mono); background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px; margin-top: 4px;">
              <strong>Revert Reason:</strong> ${data.revertReason || "Caller lacks required role"}
            </div>
            <div style="font-size: 0.75rem; color: #fecdd3; opacity: 0.8; margin-top: 2px;">
              <strong>Enforced by:</strong> ${data.enforcedBy || "Smart Contract AccessControl"}
            </div>
          </div>
        `;
        showToast("Simulation: Access Denied by Smart Contract.", "error");
      }
    } catch (err) {
      simResultContainer.style.display = "block";
      simResultContainer.innerHTML = `
        <div class="sim-result-banner sim-result-denied">
          <strong>Simulation Error:</strong> ${err.message}
        </div>
      `;
    } finally {
      setLoading(btnRunSim, false);
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

  // Initial Load
  loadRolesData();
});
