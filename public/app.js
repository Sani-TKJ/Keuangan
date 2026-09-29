const USER_ID = "6281343229317";

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(date) {
  return new Date(date).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadSummary() {
  try {

    const response = await fetch(
      `/api/summary?user_id=${encodeURIComponent(USER_ID)}`
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    const data = result.data;

    document.getElementById("balance").textContent =
      rupiah(data.balance);

    document.getElementById("income").textContent =
      rupiah(data.income);

    document.getElementById("expense").textContent =
      rupiah(data.expense);

    document.getElementById("saving").textContent =
      rupiah(data.saving);

    document.getElementById("totalMoney").textContent =
      rupiah(data.total_money);

  } catch (error) {

    console.error("Summary error:", error);

  }
}

async function loadTransactions() {

  const container =
    document.getElementById("transactionList");

  try {

    const response = await fetch(
      `/api/history?user_id=${encodeURIComponent(USER_ID)}`
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    const transactions = result.data;

    if (!transactions.length) {

      container.innerHTML = `
        <div class="empty">
          Belum ada transaksi.
        </div>
      `;

      return;
    }

    container.innerHTML = transactions
      .map(transaction => {

        let icon = "💰";
        let sign = "+";
        let className = "income";

        if (transaction.type === "expense") {
          icon = "🔴";
          sign = "-";
          className = "expense";
        }

        if (transaction.type === "saving") {
          icon = "🏦";
          sign = "-";
          className = "saving";
        }

        return `
          <div class="transaction">

            <div class="transaction-info">

              <div class="icon">
                ${icon}
              </div>

              <div>
                <div class="transaction-name">
                  ${escapeHTML(transaction.description)}
                </div>

                <div class="transaction-date">
                  ${formatDate(transaction.created_at)}
                </div>
              </div>

            </div>

            <div class="amount ${className}">
              ${sign}${rupiah(transaction.amount)}
            </div>

          </div>
        `;

      })
      .join("");

  } catch (error) {

    console.error("History error:", error);

    container.innerHTML = `
      <div class="empty">
        Gagal mengambil data transaksi.
      </div>
    `;
  }
}

function escapeHTML(text) {

  const div = document.createElement("div");

  div.textContent = text ?? "";

  return div.innerHTML;
}

async function loadData() {

  await Promise.all([
    loadSummary(),
    loadTransactions()
  ]);

}

loadData();
