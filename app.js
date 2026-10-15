// Ganti dengan ID WhatsApp yang dipakai oleh akun pemilik dashboard.
// Catatan: ID ini bukan sistem login. Jangan gunakan dashboard publik untuk data sensitif tanpa autentikasi.
const USER_ID = "6281343229317";
const $ = (id) => document.getElementById(id);
let transactions = [];

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function formatDate(value) {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.style.color = isError ? "#edaaaa" : "#bdbdbd";
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || `Permintaan gagal (${response.status})`);
  return result;
}
function selectedMonth() { return $("monthPicker").value || currentMonth(); }
async function loadData() {
  $("refreshButton").disabled = true;
  setStatus("Memuat data…");
  const month = selectedMonth();
  try {
    const [summaryResult, historyResult] = await Promise.all([
      request(`/api/summary?user_id=${encodeURIComponent(USER_ID)}&month=${encodeURIComponent(month)}`),
      request(`/api/story?user_id=${encodeURIComponent(USER_ID)}&month=${encodeURIComponent(month)}`)
    ]);
    const data = summaryResult.data || {};
    const monthly = data.monthly || {};
    $("balance").textContent = rupiah(data.balance);
    $("totalIncome").textContent = rupiah(data.income);
    $("monthIncome").textContent = rupiah(monthly.income);
    $("monthExpense").textContent = rupiah(monthly.expense);
    $("monthNet").textContent = rupiah(monthly.net);
    $("monthNet").className = Number(monthly.net || 0) < 0 ? "negative" : "positive";
    transactions = Array.isArray(historyResult.data) ? historyResult.data : [];
    renderTransactions();
    setStatus("");
  } catch (error) {
    console.error("Keuangan load error:", error);
    setStatus(error.message || "Gagal memuat data.", true);
    $("transactionList").innerHTML = '<p class="empty">Data tidak dapat dimuat. Coba muat ulang.</p>';
  } finally {
    $("refreshButton").disabled = false;
  }
}
function renderTransactions() {
  const container = $("transactionList");
  if (!transactions.length) {
    container.innerHTML = '<p class="empty">Belum ada transaksi pada bulan ini.</p>';
    return;
  }
  container.innerHTML = transactions.map((item) => {
    const type = ["income", "expense", "saving"].includes(item.type) ? item.type : "income";
    const typeLabel = { income: "Pemasukan", expense: "Pengeluaran", saving: "Tabungan" }[type];
    const sign = type === "income" ? "+" : "−";
    return `<article class="transaction">
      <div class="transaction-main">
        <div class="transaction-title">${escapeHTML(item.description || "Tanpa keterangan")}</div>
        <div class="transaction-meta">${typeLabel}${item.category ? ` · ${escapeHTML(item.category)}` : ""} · ${escapeHTML(formatDate(item.created_at))} · ID ${escapeHTML(item.id)}</div>
      </div>
      <div class="transaction-right">
        <div class="transaction-amount ${type}">${sign}${rupiah(item.amount)}</div>
        <div class="row-actions"><button class="small-action" type="button" data-edit="${escapeHTML(item.id)}">Edit</button><button class="small-action delete" type="button" data-delete="${escapeHTML(item.id)}">Hapus</button></div>
      </div>
    </article>`;
  }).join("");
}
function openEditor(id) {
  const item = transactions.find((transaction) => String(transaction.id) === String(id));
  if (!item) return setStatus("Transaksi tidak ditemukan. Muat ulang data.", true);
  $("editId").value = item.id;
  $("editType").value = item.type;
  $("editAmount").value = Number(item.amount);
  $("editDescription").value = item.description || "";
  $("editCategory").value = item.category || "";
  $("editDialog").showModal();
}
async function deleteTransaction(id) {
  const item = transactions.find((transaction) => String(transaction.id) === String(id));
  if (!item) return;
  if (!confirm(`Hapus transaksi “${item.description}” sebesar ${rupiah(item.amount)}? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    setStatus("Menghapus transaksi…");
    await request("/api/transaction", { method: "DELETE", body: JSON.stringify({ user_id: USER_ID, id }) });
    setStatus("Transaksi berhasil dihapus.");
    await loadData();
  } catch (error) {
    setStatus(error.message || "Gagal menghapus transaksi.", true);
  }
}
$("transactionList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) openEditor(editButton.dataset.edit);
  if (deleteButton) deleteTransaction(deleteButton.dataset.delete);
});
$("editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    user_id: USER_ID,
    id: $("editId").value,
    type: $("editType").value,
    amount: Number($("editAmount").value),
    description: $("editDescription").value.trim(),
    category: $("editCategory").value.trim() || null
  };
  if (!payload.description || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    setStatus("Isi keterangan dan nominal yang valid.", true);
    return;
  }
  const submit = $("editForm").querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request("/api/transaction", { method: "PATCH", body: JSON.stringify(payload) });
    $("editDialog").close();
    setStatus("Transaksi berhasil diperbarui.");
    await loadData();
  } catch (error) {
    setStatus(error.message || "Gagal mengubah transaksi.", true);
  } finally {
    submit.disabled = false;
  }
});
$("closeDialog").addEventListener("click", () => $("editDialog").close());
$("cancelEdit").addEventListener("click", () => $("editDialog").close());
$("refreshButton").addEventListener("click", loadData);
$("monthPicker").addEventListener("change", loadData);
$("monthPicker").value = currentMonth();
loadData();
