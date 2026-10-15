const USER_ID = "6281343229317";

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

async function loadTransactions() {
  const container = document.getElementById("transactionList");
  const response = await fetch(`/api/story?user_id=${encodeURIComponent(USER_ID)}`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

  const transactions = Array.isArray(result.data) ? result.data : [];
  if (!transactions.length) {
    container.innerHTML = '<div class="empty">Belum ada transaksi.</div>';
    return;
  }

  container.innerHTML = transactions.map(transaction => {
    const isExpense = transaction.type === "expense";
    const icon = isExpense ? "📤" : "📥";
    const sign = isExpense ? "−" : "+";
    const className = isExpense ? "expense" : "income";
    return `
      <div class="transaction">
        <div class="transaction-info">
          <div class="icon">${icon}</div>
          <div>
            <div class="transaction-name">${escapeHTML(transaction.description)}</div>
            <div class="transaction-date">${formatDate(transaction.created_at)}</div>
          </div>
        </div>
        <div class="amount ${className}">${sign}${rupiah(transaction.amount)}</div>
      </div>
    `;
  }).join("");
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function loadData() {
  const container = document.getElementById("transactionList");
  document.getElementById("refreshButton").disabled = true;
  try {
    await Promise.all([loadSummary(), loadTransactions()]);
  } catch (error) {
    console.error("Dashboard error:", error);
    container.innerHTML = '<div class="empty">Gagal memuat data. Coba refresh lagi.</div>';
  } finally {
    document.getElementById("refreshButton").disabled = false;
  }
}

document.getElementById("refreshButton").addEventListener("click", loadData);
loadData();
