import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ success: false, message: "DATABASE_URL belum diatur" });
  }

  try {
    if (req.method === "POST") {
      const { user_id, type, category, description, amount } = req.body ?? {};
      const nominal = validAmount(amount);

      if (!user_id || !type || !String(description ?? "").trim() || amount === undefined) {
        return res.status(400).json({ success: false, message: "Data transaksi tidak lengkap" });
      }
      if (!nominal) {
        return res.status(400).json({ success: false, message: "Nominal harus lebih dari 0" });
      }
      if (!["income", "expense"].includes(type)) {
        return res.status(400).json({ success: false, message: "Tipe transaksi harus income atau expense" });
      }

      const result = await sql`
        INSERT INTO transactions (user_id, type, category, description, amount)
        VALUES (${String(user_id)}, ${type}, ${category ? String(category) : null}, ${String(description).trim()}, ${nominal})
        RETURNING id, user_id, type, category, description, amount, created_at
      `;
      return res.status(201).json({ success: true, message: "Transaksi berhasil disimpan", data: result[0] });
    }

    if (req.method === "PATCH") {
      const { user_id, id: rawId, type, category, description, amount } = req.body ?? {};
      const id = validId(rawId);
      const nominal = validAmount(amount);

      if (!user_id || !id || !type || !String(description ?? "").trim() || amount === undefined) {
        return res.status(400).json({ success: false, message: "user_id, id, tipe, keterangan, dan nominal wajib diisi" });
      }
      if (!nominal) {
        return res.status(400).json({ success: false, message: "Nominal harus lebih dari 0" });
      }
      if (!["income", "expense"].includes(type)) {
        return res.status(400).json({ success: false, message: "Tipe transaksi harus income atau expense" });
      }

      const result = await sql`
        UPDATE transactions
        SET type = ${type}, category = ${category ? String(category) : null},
            description = ${String(description).trim()}, amount = ${nominal}
        WHERE id = ${id} AND user_id = ${String(user_id)}
          AND type IN ('income', 'expense')
        RETURNING id, user_id, type, category, description, amount, created_at
      `;
      if (!result.length) {
        return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
      }
      return res.status(200).json({ success: true, message: "Transaksi berhasil diedit", data: result[0] });
    }

    if (req.method === "DELETE") {
      const { user_id, id: rawId } = req.body ?? {};
      const id = validId(rawId);
      if (!user_id || !id) {
        return res.status(400).json({ success: false, message: "user_id dan id transaksi wajib diisi" });
      }

      const result = await sql`
        DELETE FROM transactions
        WHERE id = ${id} AND user_id = ${String(user_id)}
          AND type IN ('income', 'expense')
        RETURNING id
      `;
      if (!result.length) {
        return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
      }
      return res.status(200).json({ success: true, message: "Transaksi berhasil dihapus", data: { id: result[0].id } });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("transaction API error:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
  }
}
