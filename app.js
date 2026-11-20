const USER_ID = "6281343229317";
const PAGE_SIZE = 5;
let allTransactions = [];
let currentMonth = "";
let monthlyTransactions = [];
let currentPage = 1;
let activeView = "dashboard";

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Tanggal tidak tersedia";
  return parsed.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function monthName(month) {
  if (!month) return "Semua periode";
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
function escapeHTML(value) {
  const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML;
}
async function getJSON(url) {
  const response = await fetch(url, { cache: "no-store" }); const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`); return result;
}
async function loadSummary(month = "") {
  const params = new URLSearchParams({ user_id: USER_ID, _: String(Date.now()) });
  params.set("month", month || currentMonthValue);
  const result = await getJSON(`/api/summary?${params}`); const data = result.data || {};
  document.getElementById("balance").textContent = rupiah(data.balance);
  document.getElementById("income").textContent = rupiah(data.income);
  document.getElementById("incomeStat").textContent = rupiah(data.income);
  document.getElementById("expense").textContent = rupiah(data.expense);
  if (result.monthly && result.monthly.month === currentMonthValue) {
    document.getElementById("dashMonthIncome").textContent = rupiah(result.monthly.income);
    document.getElementById("dashMonthExpense").textContent = rupiah(result.monthly.expense);
    document.getElementById("dashMonthIncomeLabel").textContent = monthName(currentMonthValue);
    document.getElementById("dashMonthExpenseLabel").textContent = monthName(currentMonthValue);
  }
  if (month && result.monthly) {
    const m = result.monthly;
    document.getElementById("monthlyExpense").textContent = rupiah(m.expense);
    document.getElementById("monthlyIncome").textContent = rupiah(m.income);
    document.getElementById("monthlyBalance").textContent = rupiah(m.balance);
    document.getElementById("monthlyLabel").textContent = monthName(month);
  }
}
function transactionHTML(transaction) {
  const isExpense = transaction.type === "expense";
  return `<div class="transaction"><div class="transaction-info"><div class="transaction-icon ${isExpense ? "expense-icon" : "income-icon"}" aria-hidden="true">${isExpense ? "↘" : "↗"}</div><div class="transaction-details"><div class="transaction-name" title="${escapeHTML(transaction.description)}">${escapeHTML(transaction.description)}</div><div class="transaction-date">${escapeHTML(transaction.category || "Tanpa kategori")} · ${formatDate(transaction.created_at)}</div></div></div><div class="amount ${isExpense ? "expense" : "income"}">${isExpense ? "−" : "+"}${rupiah(transaction.amount)}</div></div>`;
}
function renderList(transactions, container, emptyText) {
  container.innerHTML = transactions.length ? transactions.map(transactionHTML).join("") : `<div class="empty">${emptyText}</div>`;
}
function renderHistoryPage() {
  const pagination = document.getElementById("historyPagination");
  const totalPages = Math.max(1, Math.ceil(allTransactions.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  renderList(allTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), document.getElementById("transactionList"), currentMonth ? "Belum ada transaksi pada bulan ini." : "Belum ada transaksi.");
  pagination.hidden = allTransactions.length <= PAGE_SIZE;
  document.getElementById("pageIndicator").textContent = `Halaman ${currentPage} dari ${totalPages}`;
  document.getElementById("previousPageButton").disabled = currentPage <= 1;
  document.getElementById("nextPageButton").disabled = currentPage >= totalPages;
}
async function loadTransactions(month = "") {
  const params = new URLSearchParams({ user_id: USER_ID, _: String(Date.now()) }); if (month) params.set("month", month);
  const result = await getJSON(`/api/story?${params}`); allTransactions = Array.isArray(result.data) ? result.data : [];
  currentMonth = month || ""; currentPage = 1; renderHistoryPage();
  renderList(allTransactions, document.getElementById("recentTransactionList"), "Belum ada transaksi.");
}
async function loadMonthly(month) {
  if (!month) return;
  document.getElementById("monthlyTransactionList").innerHTML = '<div class="loading">Memuat transaksi...</div>';
  const params = new URLSearchParams({ user_id: USER_ID, month, _: String(Date.now()) });
  const result = await getJSON(`/api/story?${params}`); monthlyTransactions = Array.isArray(result.data) ? result.data : [];
  renderList(monthlyTransactions, document.getElementById("monthlyTransactionList"), "Belum ada pengeluaran atau pemasukan pada bulan ini.");
}
function showView(viewName) {
  activeView = viewName;
  const views = { dashboard: "dashboardView", monthly: "monthlyView", history: "historyView" };
  Object.entries(views).forEach(([name, id]) => document.getElementById(id).classList.toggle("hidden", name !== viewName));
  const titles = { dashboard: ["Dashboard Keuangan", "Pantau arus uangmu. Tetap sadar, tetap terkendali."], monthly: ["Laporan Bulanan", "Lihat pengeluaran dan pemasukan berdasarkan periode."], history: ["Riwayat Transaksi", "Seluruh catatan keuangan dalam satu tempat."] };
  document.getElementById("pageTitle").innerHTML = `${titles[viewName][0]}<span class="title-mark">✳</span>`;
  document.getElementById("pageSubtitle").textContent = titles[viewName][1];
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === viewName));
  if (viewName === "history") loadTransactions(currentMonth).catch(showLoadError);
  if (viewName === "monthly") refreshMonthly().catch(showLoadError);
}
function showLoadError(error) {
  console.error("Keuangan dashboard error:", error);
  const message = '<div class="empty">Gagal memuat data. Periksa koneksi lalu tekan Refresh.</div>';
  ["transactionList", "recentTransactionList", "monthlyTransactionList"].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = message; });
}
async function refreshDashboard() {
  const button = document.getElementById("dashboardRefreshButton"); button.disabled = true;
  try { await Promise.all([loadSummary(), loadTransactions("")]); } catch (error) { showLoadError(error); } finally { button.disabled = false; }
}
async function refreshMonthly() {
  const month = document.getElementById("monthlyFilter").value;
  if (!month) return;
  await Promise.all([loadSummary(month), loadMonthly(month)]);
}
async function refreshHistory() {
  const button = document.getElementById("refreshButton"); button.disabled = true;
  try { await loadTransactions(currentMonth); } catch (error) { showLoadError(error); } finally { button.disabled = false; }
}
document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
document.getElementById("viewHistoryButton").addEventListener("click", () => showView("history"));
document.getElementById("dashboardRefreshButton").addEventListener("click", refreshDashboard);
document.getElementById("refreshButton").addEventListener("click", refreshHistory);
document.getElementById("monthlyFilter").addEventListener("change", () => refreshMonthly().catch(showLoadError));
document.getElementById("monthFilter").addEventListener("change", event => loadTransactions(event.target.value || "").catch(showLoadError));
document.getElementById("allHistoryButton").addEventListener("click", () => { document.getElementById("monthFilter").value = ""; loadTransactions("").catch(showLoadError); });
document.getElementById("previousPageButton").addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderHistoryPage(); } });
document.getElementById("nextPageButton").addEventListener("click", () => { if (currentPage < Math.ceil(allTransactions.length / PAGE_SIZE)) { currentPage++; renderHistoryPage(); } });
const now = new Date();
const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
document.getElementById("monthlyFilter").value = currentMonthValue;
Promise.all([loadSummary(), loadTransactions("")]).then(() => refreshMonthly()).catch(showLoadError);
