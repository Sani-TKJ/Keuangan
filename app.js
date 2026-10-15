const USER_ID = "6281343229317";
let allTransactions = [];
let currentMonth = "";

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Tanggal tidak tersedia";
  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function loadSummary() {
  const response = await fetch(`/api/summary?user_id=${encodeURIComponent(USER_ID)}`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

  const data = result.data || {};
  document.getElementById("balance").textContent = rupiah(data.balance);
  document.getElementById("income").textContent = rupiah(data.income);
  document.getElementById("incomeStat").textContent = rupiah(data.income);
  document.getElementById("expense").textContent = rupiah(data.expense);
}

function transactionHTML(transaction) {
  const isExpense = transaction.type === "expense";
  const icon = isExpense ? "📤" : "📥";
  const sign = isExpense ? "−" : "+";
  const className = isExpense ? "expense" : "income";
  return `
    <div class="transaction">
      <div class="transaction-info">
        <div class="transaction-icon" aria-hidden="true">${icon}</div>
        <div class="transaction-details">
          <div class="transaction-name">${escapeHTML(transaction.description)}</div>
          <div class="transaction-date">${formatDate(transaction.created_at)}</div>
        </div>
      </div>
      <div class="amount ${className}">${sign}${rupiah(transaction.amount)}</div>
    </div>
  `;
}

function renderTransactions(transactions, container, emptyText) {
  if (!transactions.length) {
    container.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  container.innerHTML = transactions.map(transactionHTML).join("");
}

async function loadTransactions(month = "") {
  const container = document.getElementById("transactionList");
  container.innerHTML = '<div class="loading">Memuat transaksi...</div>';
  const params = new URLSearchParams({ user_id: USER_ID });
  if (month) params.set("month", month);

  const response = await fetch(`/api/story?${params.toString()}`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

  const transactions = Array.isArray(result.data) ? result.data : [];
  currentMonth = month;
  allTransactions = transactions;
  renderTransactions(transactions, container, month ? "Belum ada transaksi pada bulan ini." : "Belum ada transaksi.");
  renderTransactions(transactions.slice(0, 5), document.getElementById("recentTransactionList"), "Belum ada transaksi.");
}

function showView(viewName) {
  const isHistory = viewName === "history";
  document.getElementById("dashboardView").classList.toggle("hidden", isHistory);
  document.getElementById("historyView").classList.toggle("hidden", !isHistory);
  document.getElementById("pageTitle").textContent = isHistory ? "Riwayat Transaksi" : "Dashboard Keuangan";
  document.getElementById("pageSubtitle").textContent = isHistory
    ? "Lihat catatan pemasukan dan pengeluaran kamu."
    : "Pantau pemasukan dan pengeluaran kamu.";

  document.querySelectorAll(".nav-link").forEach(button => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (isHistory) loadTransactions(currentMonth).catch(showLoadError);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLoadError(error) {
  console.error("Dashboard error:", error);
  document.getElementById("transactionList").innerHTML = '<div class="empty">Gagal memuat riwayat. Coba refresh lagi.</div>';
  document.getElementById("recentTransactionList").innerHTML = '<div class="empty">Gagal memuat data. Coba refresh lagi.</div>';
}

async function refreshData() {
  const refreshButton = document.getElementById("refreshButton");
  refreshButton.disabled = true;
  try {
    await Promise.all([loadSummary(), loadTransactions(currentMonth)]);
  } catch (error) {
    showLoadError(error);
  } finally {
    refreshButton.disabled = false;
  }
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});
document.getElementById("viewHistoryButton").addEventListener("click", () => showView("history"));
document.getElementById("refreshButton").addEventListener("click", refreshData);
document.getElementById("monthFilter").addEventListener("change", async event => {
  try {
    await loadTransactions(event.target.value);
  } catch (error) {
    showLoadError(error);
  }
});
document.getElementById("allHistoryButton").addEventListener("click", async () => {
  document.getElementById("monthFilter").value = "";
  try {
    await loadTransactions("");
  } catch (error) {
    showLoadError(error);
  }
});

Promise.all([loadSummary(), loadTransactions("")]).catch(showLoadError);
