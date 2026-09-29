
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id wajib diisi"
      });
    }

    const result = await sql`
      SELECT
        id,
        type,
        category,
        description,
        amount,
        created_at
      FROM transactions
      WHERE user_id = ${user_id}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil riwayat"
    });
  }
}
