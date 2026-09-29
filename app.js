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

// ==========================================
// LOAD SUMMARY
// ==========================================

async function loadSummary() {
  try {
    const response = await fetch(
      `/api/summary?user_id=${encodeURIComponent(USER_ID)}`
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        `HTTP ${response.status}`
      );
    }

    const data = result.data || {};

    const balance =
      Number(data.balance || 0);

    const income =
      Number(data.income || 0);

    const expense =
      Number(data.expense || 0);

    const saving =
      Number(data.saving || 0);

    document.getElementById("balance").textContent =
      rupiah(balance);

    document.getElementById("income").textContent =
      rupiah(income);

    document.getElementById("expense").textContent =
      rupiah(expense);

    document.getElementById("saving").textContent =
      rupiah(saving);

    // Total uang yang tercatat
    const totalMoney =
      income + saving;

    document.getElementById("totalMoney").textContent =
      rupiah(totalMoney);

  } catch (error) {
    console.error(
      "Summary error:",
      error
    );
  }
}

// ==========================================
// LOAD TRANSACTIONS
// ==========================================

async function loadTransactions() {

  const container =
    document.getElementById(
      "transactionList"
    );

  try {

    const response = await fetch(
      `/api/story?user_id=${encodeURIComponent(USER_ID)}`
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        `HTTP ${response.status}`
      );
    }

    const transactions =
      Array.isArray(result.data)
        ? result.data
        : [];

    if (!transactions.length) {

      container.innerHTML = `
        <div class="empty">
          Belum ada transaksi.
        </div>
      `;

      return;
    }

    container.innerHTML =
      transactions
        .map(transaction => {

          let icon = "💰";
          let sign = "+";
          let className = "income";

          if (
            transaction.type ===
            "expense"
          ) {
            icon = "🔴";
            sign = "-";
            className = "expense";
          }

          if (
            transaction.type ===
            "saving"
          ) {
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
                    ${escapeHTML(
                      transaction.description
                    )}
                  </div>

                  <div class="transaction-date">
                    ${formatDate(
                      transaction.created_at
                    )}
                  </div>

                </div>

              </div>

              <div class="amount ${className}">
                ${sign}${rupiah(
                  transaction.amount
                )}
              </div>

            </div>
          `;

        })
        .join("");

  } catch (error) {

    console.error(
      "History error:",
      error
    );

    container.innerHTML = `
      <div class="empty">
        Gagal mengambil data transaksi.
      </div>
    `;
  }
}

// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(text) {

  const div =
    document.createElement("div");

  div.textContent =
    text ?? "";

  return div.innerHTML;
}

// ==========================================
// LOAD ALL DATA
// ==========================================

async function loadData() {

  await Promise.all([
    loadSummary(),
    loadTransactions()
  ]);

}

// ==========================================
// START
// ==========================================

loadData();
