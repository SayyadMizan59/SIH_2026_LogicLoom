document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const auditTableBody = document.getElementById("auditTableBody");
  const auditCountBadge = document.getElementById("auditCountBadge");
  const auditSearchInput = document.getElementById("auditSearchInput");
  const filterPills = document.querySelectorAll("[data-audit-filter]");
  const btnRefreshAudit = document.getElementById("btnRefreshAudit");
  const auditRefreshIcon = document.getElementById("auditRefreshIcon");
  const auditContractAddr = document.getElementById("auditContractAddr");

  // Modal Elements
  const modalTransactionInspector = document.getElementById("modalTransactionInspector");
  const txBlockBadge = document.getElementById("txBlockBadge");
  const txHashVal = document.getElementById("txHashVal");
  const txFromVal = document.getElementById("txFromVal");
  const txToVal = document.getElementById("txToVal");
  const txTimestampVal = document.getElementById("txTimestampVal");
  const txGasUsedVal = document.getElementById("txGasUsedVal");
  const txActionDetailsVal = document.getElementById("txActionDetailsVal");

  // Export Buttons
  const btnExportJsonAudit = document.getElementById("btnExportJsonAudit");
  const btnExportCsvAudit = document.getElementById("btnExportCsvAudit");

  // State
  let allAuditLogs = [];
  let currentCategory = "all";

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

  // Format date helper: "31 Aug 2026 23:10"
  function formatAuditTimestamp(isoString) {
    try {
      const d = new Date(isoString);
      const day = d.getDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${month} ${year} ${hours}:${mins}`;
    } catch {
      return "Recent";
    }
  }

  // Load Audit Logs
  async function loadAuditLogs() {
    try {
      const [resLogs, resStats] = await Promise.all([
        fetch("/api/audit/logs"),
        fetch("/api/admin/stats"),
      ]);

      const dataLogs = await resLogs.json();
      const dataStats = await resStats.json();

      if (dataStats.success && dataStats.contract) {
        auditContractAddr.textContent = `${dataStats.contract.address.slice(0, 6)}...${dataStats.contract.address.slice(-4)}`;
        auditContractAddr.title = dataStats.contract.address;
      }

      if (dataLogs.success) {
        allAuditLogs = dataLogs.logs;
        auditCountBadge.textContent = `${allAuditLogs.length} Events Verified`;
        renderAuditTable();
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--admin-rose); padding: 30px;">
            Error loading audit trail: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  function renderAuditTable() {
    const search = auditSearchInput.value.toLowerCase().trim();

    const filtered = allAuditLogs.filter((log) => {
      // Filter by category pill
      if (currentCategory !== "all" && log.category !== currentCategory) {
        return false;
      }

      // Filter by search
      if (search) {
        const matchAction = log.action.toLowerCase().includes(search);
        const matchActor = (log.actor || "").toLowerCase().includes(search);
        const matchTarget = (log.target || "").toLowerCase().includes(search);
        const matchWallet = (log.wallet || "").toLowerCase().includes(search);
        const matchDid = (log.did || "").toLowerCase().includes(search);
        const matchTx = (log.transactionHash || "").toLowerCase().includes(search);
        const matchBlock = `block #${log.blockNumber}`.toLowerCase().includes(search);
        const matchNft = log.nftId && (`token #${log.nftId}`.includes(search) || log.nftId === search);
        return matchAction || matchActor || matchTarget || matchWallet || matchDid || matchTx || matchBlock || matchNft;
      }

      return true;
    });

    if (filtered.length === 0) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No audit logs found matching current filter.
          </td>
        </tr>
      `;
      return;
    }

    auditTableBody.innerHTML = filtered
      .map((log) => {
        const formattedDate = formatAuditTimestamp(log.timestamp);
        const shortAddr = log.wallet ? `${log.wallet.slice(0, 6)}...${log.wallet.slice(-4)}` : "--";
        const shortDid = log.did ? `${log.did.slice(0, 14)}...` : `did:ethr:${shortAddr}`;
        const shortTx = log.transactionHash ? `${log.transactionHash.slice(0, 8)}...` : "--";

        let statusBadge = `<span class="status-badge-success"><span class="status-dot-sm"></span> Success</span>`;
        if (log.status === "Denied") {
          statusBadge = `<span class="action-badge badge-access-denied" style="font-size: 0.72rem;">Denied</span>`;
        } else if (log.status === "Verified") {
          statusBadge = `<span class="action-badge badge-IDENTITY_VERIFIED" style="font-size: 0.72rem;">Verified</span>`;
        }

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.8rem;" title="${log.timestamp}">
              ${formattedDate}
            </td>
            <td>
              <span class="audit-action-badge badge-${log.action}">
                ${log.action}
              </span>
            </td>
            <td>
              <div style="font-weight: 600; color: #fff;">${log.actor}</div>
              <div class="mono" style="font-size: 0.72rem; color: var(--text-muted);" title="${log.actorAddress}">${log.actorAddress ? `${log.actorAddress.slice(0, 6)}...` : ""}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #cbd5e1;">${log.target}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${log.targetDetails || ""}</div>
            </td>
            <td>
              <div class="mono" style="color: var(--secondary); font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to copy DID" onclick="window.copyText('${log.did}', 'DID')">
                ${shortDid}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
              <div class="mono" style="font-size: 0.72rem; color: var(--text-muted); cursor: pointer;" title="Click to copy wallet" onclick="window.copyText('${log.wallet}', 'Wallet')">
                ${shortAddr}
              </div>
            </td>
            <td>
              <span class="act-block-badge">Block #${log.blockNumber}</span>
            </td>
            <td>
              <div class="mono" style="color: #cbd5e1; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to copy Tx" onclick="window.copyText('${log.transactionHash}', 'Tx Hash')">
                ${shortTx}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td style="text-align: right;">
              <button class="chip-btn" style="background: rgba(99, 102, 241, 0.15); color: var(--primary); border-color: rgba(99, 102, 241, 0.3);" onclick="window.openTxModal('${log.transactionHash}', '${log.action}', '${log.target}')">
                View Tx
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Filter Pills
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.getAttribute("data-audit-filter");
      renderAuditTable();
    });
  });

  // Search Input
  auditSearchInput.addEventListener("input", renderAuditTable);

  btnRefreshAudit.addEventListener("click", async () => {
    auditRefreshIcon.classList.add("spinning");
    await loadAuditLogs();
    setTimeout(() => auditRefreshIcon.classList.remove("spinning"), 600);
    showToast("Audit trail synchronized with blockchain.");
  });

  // ==========================================
  // Transaction Inspector Modal
  // ==========================================
  window.openTxModal = async (txHash, action, target) => {
    try {
      const res = await fetch(`/api/audit/transaction/${txHash}`);
      const data = await res.json();

      if (data.success) {
        const tx = data.transaction;
        txBlockBadge.textContent = `Block #${tx.blockNumber}`;
        txHashVal.textContent = tx.transactionHash;
        txHashVal.onclick = () => window.copyText(tx.transactionHash, "Transaction Hash");

        txFromVal.textContent = tx.from;
        txFromVal.onclick = () => window.copyText(tx.from, "Sender Address");

        txToVal.textContent = tx.to;
        txToVal.onclick = () => window.copyText(tx.to, "Contract Address");

        txTimestampVal.textContent = new Date(tx.timestamp).toLocaleString();
        txGasUsedVal.textContent = `${parseInt(tx.gasUsed).toLocaleString()} Gas Units`;
        txActionDetailsVal.textContent = `${action || "Smart Contract Execution"} — ${target || ""}`;

        modalTransactionInspector.classList.add("active");
      } else {
        showToast("Transaction details not available on RPC.", "error");
      }
    } catch (err) {
      showToast("Error inspecting transaction: " + err.message, "error");
    }
  };

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalTransactionInspector.classList.remove("active");
    });
  });

  modalTransactionInspector.addEventListener("click", (e) => {
    if (e.target === modalTransactionInspector) {
      modalTransactionInspector.classList.remove("active");
    }
  });

  // ==========================================
  // Export Handlers
  // ==========================================
  btnExportJsonAudit.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(allAuditLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credexa-audit-trail-${Date.now()}.json`;
    a.click();
    showToast("Audit trail JSON exported.");
  });

  btnExportCsvAudit.addEventListener("click", () => {
    if (allAuditLogs.length === 0) return;
    const headers = ["Timestamp", "Action", "Category", "Actor", "Target", "Wallet", "DID", "BlockNumber", "TransactionHash", "Status"];
    const rows = allAuditLogs.map((l) => [
      l.timestamp,
      l.action,
      l.category,
      `"${l.actor || ""}"`,
      `"${l.target || ""}"`,
      l.wallet || "",
      l.did || "",
      l.blockNumber,
      l.transactionHash,
      l.status,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credexa-audit-trail-${Date.now()}.csv`;
    a.click();
    showToast("Audit trail CSV exported.");
  });

  // Initial load
  loadAuditLogs();
});
