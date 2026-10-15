const USER_ID = "6281343229317";
const PAGE_SIZE = 4;
let allTransactions = [];
let currentMonth = "";
let currentPage = 1;
let activeView = "dashboard";

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Tanggal tidak tersedia";
  return parsed.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function getJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
  return result;
}

async function loadSummary() {
  const result = await getJSON(`/api/summary?user_id=${encodeURIComponent(USER_ID)}&_=${Date.now()}`);
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
          <div class="transaction-name" title="${escapeHTML(transaction.description)}">${escapeHTML(transaction.description)}</div>
          <div class="transaction-date">${formatDate(transaction.created_at)}</div>
        </div>
      </div>
      <div class="amount ${className}">${sign}${rupiah(transaction.amount)}</div>
    </div>`;
}

function renderList(transactions, container, emptyText) {
  if (!transactions.length) {
    container.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  container.innerHTML = transactions.map(transactionHTML).join("");
}

function renderHistoryPage() {
  const container = document.getElementById("transactionList");
  const pagination = document.getElementById("historyPagination");
  const totalPages = Math.max(1, Math.ceil(allTransactions.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = allTransactions.slice(start, start + PAGE_SIZE);
  renderList(pageItems, container, currentMonth ? "Belum ada transaksi pada bulan ini." : "Belum ada transaksi.");
  pagination.hidden = allTransactions.length <= PAGE_SIZE;
  document.getElementById("pageIndicator").textContent = `Halaman ${currentPage} dari ${totalPages}`;
  document.getElementById("previousPageButton").disabled = currentPage <= 1;
  document.getElementById("nextPageButton").disabled = currentPage >= totalPages;
}

async function loadTransactions(month = currentMonth) {
  const historyContainer = document.getElementById("transactionList");
  const recentContainer = document.getElementById("recentTransactionList");
  historyContainer.innerHTML = '<div class="loading">Memuat transaksi...</div>';
  recentContainer.innerHTML = '<div class="loading">Memuat transaksi...</div>';
  const params = new URLSearchParams({ user_id: USER_ID, _: String(Date.now()) });
  if (month) params.set("month", month);
  const result = await getJSON(`/api/story?${params.toString()}`);
  allTransactions = Array.isArray(result.data) ? result.data : [];
  currentMonth = month || "";
  currentPage = 1;
  renderHistoryPage();
  renderList(allTransactions.slice(0, 3), recentContainer, "Belum ada transaksi.");
}

function showView(viewName) {
  activeView = viewName;
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
}

function showLoadError(error) {
  console.error("Keuangan dashboard error:", error);
  const message = '<div class="empty">Gagal memuat data. Tekan Refresh untuk mencoba lagi.</div>';
  document.getElementById("transactionList").innerHTML = message;
  document.getElementById("recentTransactionList").innerHTML = message;
}

async function refreshDashboard() {
  const button = document.getElementById("dashboardRefreshButton");
  button.disabled = true;
  try {
    await Promise.all([loadSummary(), loadTransactions(currentMonth)]);
  } catch (error) {
    showLoadError(error);
  } finally {
    button.disabled = false;
  }
}

async function refreshHistory() {
  const button = document.getElementById("refreshButton");
  button.disabled = true;
  try {
    await loadTransactions(currentMonth);
  } catch (error) {
    showLoadError(error);
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});
document.getElementById("viewHistoryButton").addEventListener("click", () => showView("history"));
document.getElementById("dashboardRefreshButton").addEventListener("click", refreshDashboard);
document.getElementById("refreshButton").addEventListener("click", refreshHistory);
document.getElementById("monthFilter").addEventListener("change", async event => {
  currentMonth = event.target.value || "";
  currentPage = 1;
  try { await loadTransactions(currentMonth); }
  catch (error) { showLoadError(error); }
});
document.getElementById("allHistoryButton").addEventListener("click", async () => {
  document.getElementById("monthFilter").value = "";
  currentMonth = "";
  currentPage = 1;
  try { await loadTransactions(""); }
  catch (error) { showLoadError(error); }
});
document.getElementById("previousPageButton").addEventListener("click", () => {
  if (currentPage > 1) { currentPage--; renderHistoryPage(); }
});
document.getElementById("nextPageButton").addEventListener("click", () => {
  if (currentPage < Math.ceil(allTransactions.length / PAGE_SIZE)) { currentPage++; renderHistoryPage(); }
});

Promise.all([loadSummary(), loadTransactions("")]).catch(showLoadError);
