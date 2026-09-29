import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const {
      user_id,
      type,
      category,
      description,
      amount
    } = req.body;

    if (!user_id || !type || !description || !amount) {
      return res.status(400).json({
        success: false,
        message: "Data transaksi tidak lengkap"
      });
    }

    const nominal = Number(amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Nominal tidak valid"
      });
    }

    const allowedTypes = [
      "income",
      "expense",
      "saving"
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Tipe transaksi tidak valid"
      });
    }

    const result = await sql`
      INSERT INTO transactions
      (
        user_id,
        type,
        category,
        description,
        amount
      )
      VALUES
      (
        ${user_id},
        ${type},
        ${category || null},
        ${description},
        ${nominal}
      )
      RETURNING *
    `;

    return res.status(201).json({
      success: true,
      message: "Transaksi berhasil disimpan",
      data: result[0]
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server"
    });
  }
}
