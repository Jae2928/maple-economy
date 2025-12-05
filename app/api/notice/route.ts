import { NextResponse } from "next/server";
import { Pool } from "pg";

// 🔹 Supabase DB 연결
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        category AS type,       -- 'NEWS' | 'UPDATE' | 'NOTICE'
        title,
        content,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
      FROM notice
      ORDER BY created_at DESC
      `
    );

    return NextResponse.json({ data: rows });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
