import { NextResponse } from "next/server";
import { Pool } from "pg";

// Supabase Postgres 연결
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const item = searchParams.get("item") ?? "메소 마켓"; // 기본값

    const { rows } = await pool.query(
      `
      SELECT
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        price
      FROM etc
      WHERE name = $1
      ORDER BY date ASC
      `,
      [item]
    );

    type Row = { date: string; price: number };
    const points = rows as Row[];

    let todayPrice: number | null = null;
    let changePercent: number | null = null;

    if (points.length > 0) {
      todayPrice = points.at(-1)!.price;
      if (points.length > 1) {
        const prev = points.at(-2)!.price;
        if (prev > 0) {
          changePercent = ((todayPrice - prev) / prev) * 100;
        }
      }
    }

    return NextResponse.json({
      item,
      points,
      todayPrice,
      changePercent,
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "market query error" },
      { status: 500 }
    );
  }
}
