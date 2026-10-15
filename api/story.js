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

    let result;
    if (month) {
      const start = `${month}-01`;
      const end = nextMonth(month);
      result = await sql`
        SELECT id, type, category, description, amount, created_at
        FROM transactions
        WHERE user_id = ${String(user_id)}
          AND created_at >= ${start}::date
          AND created_at < ${end}::date
        ORDER BY created_at DESC
        LIMIT 500
      `;
    } else {
      result = await sql`
        SELECT id, type, category, description, amount, created_at
        FROM transactions
        WHERE user_id = ${String(user_id)}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("story API error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil riwayat" });
  }
}
