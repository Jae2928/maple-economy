// app/api/price/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs"; // 🔹 pg는 node 런타임에서만

// ─────────────────────────────────────────────
// 1. 환경 변수/커넥션 문자열 디버그
// ─────────────────────────────────────────────

const rawConnectionString = process.env.SUPABASE_DB_URL;

function maskConnectionString(cs?: string): string | undefined {
  if (!cs) return undefined;
  // 비밀번호 부분만 **** 로 마스킹
  return cs.replace(/(:)([^:@]+)(@)/, (_m, p1, _pw, p3) => `${p1}****${p3}`);
}

const masked = maskConnectionString(rawConnectionString);

if (!rawConnectionString) {
  console.error("[/api/price] ❌ SUPABASE_DB_URL is NOT set");
} else {
  console.log(
    "[/api/price] ✅ SUPABASE_DB_URL is set:",
    masked ? masked.slice(0, 60) : "undefined"
  );
}

// Pool을 any로 두면 타입 에러 없이 디버깅 가능
const pool: any = rawConnectionString
  ? new Pool({
      connectionString: rawConnectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

// ─────────────────────────────────────────────
// 2. 실제 핸들러
// ─────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  if (!pool) {
    return NextResponse.json(
      {
        error: "SUPABASE_DB_URL is not configured on the server",
      },
      { status: 500 }
    );
  }

  let client: any;

  try {
    console.log("[/api/price] STEP 1: acquiring client...");
    client = await pool.connect();
    console.log("[/api/price] STEP 1 OK: client acquired");

    // ── (A) 헬스 체크 쿼리 ──────────────────────
    console.log("[/api/price] STEP 2: running health check query...");
    const health: any = await client.query(
      "SELECT current_database() AS db, current_user AS user"
    );
    console.log("[/api/price] STEP 2 OK: health =", health?.rows?.[0]);

    // ── (B) 실제 price_history 쿼리 ────────────
    console.log("[/api/price] STEP 3: running main query on price_history...");
    const result: any = await client.query(`
      SELECT
        name,
        price,
        TO_CHAR(date, 'YYYY-MM-DD') AS date
      FROM price_history
      ORDER BY date ASC
      LIMIT 100
    `);

    const rowCount =
      typeof result?.rowCount === "number"
        ? result.rowCount
        : Array.isArray(result?.rows)
        ? result.rows.length
        : 0;

    console.log("[/api/price] STEP 3 OK: rowCount =", rowCount);

    return NextResponse.json(
      {
        data: result.rows ?? [],
        meta: {
          rowCount,
          health: health?.rows?.[0],
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[/api/price] ❌ ERROR name    :", e?.name);
    console.error("[/api/price] ❌ ERROR code    :", e?.code);
    console.error("[/api/price] ❌ ERROR message :", e?.message);
    console.error("[/api/price] ❌ ERROR stack   :", e?.stack);

    return NextResponse.json(
      {
        error: "Internal server error",
        detail: {
          name: e?.name,
          code: e?.code,
          message: e?.message,
        },
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      console.log("[/api/price] STEP 4: releasing client");
      client.release();
    }
  }
}
