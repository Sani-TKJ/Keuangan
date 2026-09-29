
const USER_ID = "6281343229317";

// Cache frontend agar tidak perlu meminta API
// setiap kali berpindah halaman.
let allTransactions = [];
let dataLoaded = false;
let isLoading = false;

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(date) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getMonthKey(date) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthLabel(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) {
    return "Semua bulan";
  }

  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1)
    .toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// ==========================================
// NAVIGASI
// ==========================================

const pageTitles = {
  dashboard: "Dashboard",
  history: "Riwayat",
  summary: "Ringkasan bulanan"
};

function showPage(page) {
  const target = document.getElementById(`page-${page}`);

  if (!target) return;

  document.querySelectorAll(".page").forEach(element => {
    element.classList.toggle(
      "active",
      element.id === `page-${page}`
    );
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.page === page;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.getElementById("pageTitle").textContent =
    pageTitles[page] || "Keuangan";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// PILIHAN BULAN
// ==========================================

function initMonthFilters() {
  const historySelect = document.getElementById("historyMonth");
  const summarySelect = document.getElementById("summaryMonth");

  const previousHistory = historySelect.value;
  const previousSummary = summarySelect.value;

  const keys = new Set();

  // Bulan saat ini tetap tersedia walau belum ada transaksi.
  keys.add(getMonthKey(new Date()));

  allTransactions.forEach(transaction => {
    const key = getMonthKey(transaction.created_at);

    if (key) keys.add(key);
  });

  const sortedKeys = [...keys].sort().reverse();

  // Opsi kosong berarti seluruh riwayat.
  historySelect.innerHTML = `
    <option value="">Semua bulan</option>
    ${sortedKeys.map(key => `
      <option value="${key}">${escapeHTML(getMonthLabel(key))}</option>
    `).join("")}
  `;

  summarySelect.innerHTML = sortedKeys.map(key => `
    <option value="${key}">${escapeHTML(getMonthLabel(key))}</option>
  `).join("");

  historySelect.value = keys.has(previousHistory)
    ? previousHistory
    : "";

  summarySelect.value = keys.has(previousSummary)
    ? previousSummary
    : getMonthKey(new Date());

  historySelect.onchange = renderHistory;
  summarySelect.onchange = renderMonthlySummary;
}

function resetHistoryFilter() {
  document.getElementById("historyMonth").value = "";
  renderHistory();
}

// ==========================================
// LOAD SUMMARY
// Endpoint tetap: /api/summary
// ==========================================

async function loadSummary() {
  const response = await fetch(
    `/api/summary?user_id=${encodeURIComponent(USER_ID)}`
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || `HTTP ${response.status}`);
  }

  const data = result.data || {};

  const balance = Number(data.balance || 0);
  const income = Number(data.income || 0);
  const expense = Number(data.expense || 0);
  const saving = Number(data.saving || 0);

  document.getElementById("balance").textContent =
    rupiah(balance);

  document.getElementById("income").textContent =
    rupiah(income);

  document.getElementById("expense").textContent =
    rupiah(expense);

  document.getElementById("saving").textContent =
    rupiah(saving);

  // Rumus total uang dipertahankan seperti kode awal.
  document.getElementById("totalMoney").textContent =
    rupiah(income + saving);
}

// ==========================================
// LOAD TRANSACTIONS
// Endpoint tetap: /api/story
// ==========================================

async function loadTransactions() {
  const response = await fetch(
    `/api/story?user_id=${encodeURIComponent(USER_ID)}`
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || `HTTP ${response.status}`);
  }

  allTransactions = Array.isArray(result.data)
    ? result.data
    : [];

  // Urutkan terbaru dahulu untuk tampilan.
  allTransactions.sort((a, b) => {
    return new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime();
  });

  dataLoaded = true;
}

// ==========================================
// KOMPONEN TRANSAKSI
// ==========================================

function transactionHTML(transaction) {
  let icon = "💰";
  let sign = "+";
  let className = "income";
  let label = "Pemasukan";

  if (transaction.type === "expense") {
    icon = "↗";
    sign = "-";
    className = "expense";
    label = "Pengeluaran";
  }

  if (transaction.type === "saving") {
    icon = "♧";
    sign = "-";
    className = "saving";
    label = "Tabungan";
  }

  return `
    <article class="transaction">
      <div class="transaction-info">
        <div class="transaction-icon ${className}">
          ${icon}
        </div>

        <div class="transaction-details">
          <div class="transaction-name">
            ${escapeHTML(transaction.description || label)}
          </div>

          <div class="transaction-date">
            ${escapeHTML(formatDate(transaction.created_at))}
          </div>
        </div>
      </div>

      <div class="transaction-right">
        <div class="amount ${className}">
          ${sign}${rupiah(transaction.amount)}
        </div>
        <div class="transaction-type">${label}</div>
      </div>
    </article>
  `;
}

function renderList(containerId, transactions, emptyMessage) {
  const container = document.getElementById(containerId);

  if (!transactions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">▤</div>
        <strong>Belum ada transaksi</strong>
        <p>${escapeHTML(emptyMessage)}</p>
      </div>
    `;

    return;
  }

  container.innerHTML = transactions
    .map(transactionHTML)
    .join("");
}

// ==========================================
// DASHBOARD: TRANSAKSI TERBARU
// ==========================================

function renderRecent() {
  renderList(
    "recentList",
    allTransactions.slice(0, 5),
    "Transaksi yang tercatat akan muncul di sini."
  );
}

// ==========================================
// RIWAYAT: FILTER PER BULAN
// ==========================================

function renderHistory() {
  const selectedMonth =
    document.getElementById("historyMonth").value;

  const filtered = selectedMonth
    ? allTransactions.filter(transaction =>
        getMonthKey(transaction.created_at) === selectedMonth
      )
    : allTransactions;

  document.getElementById("historyCount").textContent =
    `${filtered.length} transaksi ditemukan`;

  renderList(
    "transactionList",
    filtered,
    selectedMonth
      ? `Tidak ada transaksi pada ${getMonthLabel(selectedMonth)}.`
      : "Transaksi yang tercatat akan muncul di sini."
  );
}

// ==========================================
// RINGKASAN BULANAN
// ==========================================

function renderMonthlySummary() {
  const selectedMonth =
    document.getElementById("summaryMonth").value;

  const transactions = allTransactions.filter(transaction =>
    getMonthKey(transaction.created_at) === selectedMonth
  );

  let income = 0;
  let expense = 0;
  let saving = 0;

  transactions.forEach(transaction => {
    const amount = Number(transaction.amount || 0);

    if (!Number.isFinite(amount)) return;

    if (transaction.type === "expense") {
      expense += amount;
    } else if (transaction.type === "saving") {
      saving += amount;
    } else if (transaction.type === "income") {
      income += amount;
    }
  });

  // Selisih transaksi dihitung dari pemasukan dikurangi
  // pengeluaran dan setoran tabungan.
  const net = income - expense - saving;

  document.getElementById("summaryPeriod").textContent =
    getMonthLabel(selectedMonth);

  document.getElementById("monthIncome").textContent =
    rupiah(income);

  document.getElementById("monthExpense").textContent =
    rupiah(expense);

  document.getElementById("monthSaving").textContent =
    rupiah(saving);

  document.getElementById("monthNet").textContent =
    rupiah(net);

  const total = income + expense + saving;

  function updateBar(name, amount) {
    const percent = total > 0
      ? (amount / total) * 100
      : 0;

    document.getElementById(`${name}Percent`).textContent =
      `${Math.round(percent)}%`;

    document.getElementById(`${name}Bar`).style.width =
      `${percent}%`;
  }

  updateBar("income", income);
  updateBar("expense", expense);
  updateBar("saving", saving);

  renderList(
    "monthlyTransactions",
    transactions,
    `Belum ada transaksi pada ${getMonthLabel(selectedMonth)}.`
  );
}

// ==========================================
// LOAD ALL DATA
// ==========================================

async function loadData() {
  if (isLoading) return;

  isLoading = true;

  const notice = document.getElementById("appNotice");
  notice.textContent = "";
  notice.classList.remove("visible");

  try {
    await Promise.all([
      loadSummary(),
      loadTransactions()
    ]);

    initMonthFilters();
    renderRecent();
    renderHistory();
    renderMonthlySummary();

    notice.textContent = "Data keuangan berhasil diperbarui.";
    notice.classList.add("visible");

    window.setTimeout(() => {
      notice.classList.remove("visible");
    }, 2500);

  } catch (error) {
    console.error("Load data error:", error);

    notice.textContent =
      "Gagal memuat data. Periksa koneksi atau API kamu.";

    notice.classList.add("visible");

    if (!dataLoaded) {
      renderList(
        "recentList",
        [],
        "Data belum dapat dimuat."
      );

      renderList(
        "transactionList",
        [],
        "Coba muat ulang halaman."
      );

      renderList(
        "monthlyTransactions",
        [],
        "Coba muat ulang halaman."
      );
    }

  } finally {
    isLoading = false;
  }
}

// ==========================================
// START
// ==========================================

loadData();
