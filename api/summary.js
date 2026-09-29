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
        COALESCE(
          SUM(
            CASE
              WHEN type = 'income' THEN amount
              WHEN type = 'saving' THEN amount
              WHEN type = 'expense' THEN -amount
              ELSE 0
            END
          ), 0
        ) AS balance,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'income' THEN amount
              ELSE 0
            END
          ), 0
        ) AS income,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'expense' THEN amount
              ELSE 0
            END
          ), 0
        ) AS expense,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'saving' THEN amount
              ELSE 0
            END
          ), 0
        ) AS saving

      FROM transactions
      WHERE user_id = ${user_id}
    `;

    return res.status(200).json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil saldo"
    });
  }
}
