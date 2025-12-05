import { NextResponse } from "next/server";
import { Pool } from "pg";

// 🔹 Supabase Postgres용 Pool 생성
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    // 🔹 pg는 이렇게 바로 query에서 rows를 꺼내 쓰면 됨
    const { rows } = await pool.query(
      `
      SELECT
        name,                             -- 🔥 Supabase 컬럼명 (item_name 아님)
        price,
        TO_CHAR(date, 'YYYY-MM-DD') AS date  -- 🔥 Postgres에서 문자열로 포맷
      FROM price_history
      ORDER BY date ASC
      `
    );

    return NextResponse.json({ data: rows });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
