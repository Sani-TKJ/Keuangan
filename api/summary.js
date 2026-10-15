import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function validMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

function nextMonth(month) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function totalsForUser(userId, start = null, end = null) {
  if (start && end) {
    const result = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE user_id = ${userId}
        AND created_at >= ${start}::date
        AND created_at < ${end}::date
    `;
    return result[0];
  }
  const result = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
    FROM transactions
    WHERE user_id = ${userId}
  `;
  return result[0];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, message: "DATABASE_URL belum diatur" });
  }

  try {
    const { user_id, month } = req.query;
    if (!user_id) return res.status(400).json({ success: false, message: "user_id wajib diisi" });
    if (month && !validMonth(month)) {
      return res.status(400).json({ success: false, message: "Format month harus YYYY-MM, contoh 2026-10" });
    }

    const userId = String(user_id);
    const allTime = await totalsForUser(userId);
    const income = Number(allTime.income);
    const expense = Number(allTime.expense);
    const data = {
      balance: income - expense,
      income,
      expense
    };

    const response = { success: true, data };
    if (month) {
      const monthlyRaw = await totalsForUser(userId, `${month}-01`, nextMonth(month));
      response.monthly = {
        income: Number(monthlyRaw.income),
        expense: Number(monthlyRaw.expense),
        balance: Number(monthlyRaw.income) - Number(monthlyRaw.expense),
        month
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("summary API error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil saldo" });
  }
}
