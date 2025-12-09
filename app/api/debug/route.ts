// app/api/db-debug/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs"; // 🔹 pg는 node 런타임에서만

// ─────────────────────────────────────────────
// 1. 환경 변수/커넥션 문자열 체크
// ─────────────────────────────────────────────

const rawConnectionString = process.env.SUPABASE_DB_URL;

function maskConnectionString(cs?: string): string | undefined {
  if (!cs) return undefined;
  // 비밀번호 부분만 **** 로 마스킹
  return cs.replace(/(:)([^:@]+)(@)/, (_m, p1, _pw, p3) => `${p1}****${p3}`);
}

const masked = maskConnectionString(rawConnectionString);

if (!rawConnectionString) {
  console.error("[/api/db-debug] ❌ SUPABASE_DB_URL is NOT set");
} else {
  console.log(
    "[/api/db-debug] ✅ SUPABASE_DB_URL is set:",
    masked ? masked.slice(0, 80) : "undefined"
  );
}

const pool: any = rawConnectionString
  ? new Pool({
      connectionString: rawConnectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

// ─────────────────────────────────────────────
// 2. 디버그용 핸들러
// ─────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const steps: any[] = [];

  // (0) env 확인
  if (!pool) {
    steps.push({
      step: "env",
      ok: false,
      message: "SUPABASE_DB_URL is not configured on the server",
    });

    return NextResponse.json(
      {
        ok: false,
        stage: "env",
        steps,
      },
      { status: 200 } // 🔹 일부러 200으로 보내서 프론트에서 보기 쉽게
    );
  }

  let client: any;

  try {
    // (1) 커넥션 획득
    try {
      steps.push({ step: "connect", message: "trying to connect..." });
      client = await pool.connect();
      steps.push({ step: "connect", ok: true, message: "client acquired" });
    } catch (e: any) {
      steps.push({
        step: "connect",
        ok: false,
        error: {
          name: e?.name,
          code: e?.code,
          message: e?.message,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          stage: "connect",
          steps,
        },
        { status: 200 }
      );
    }

    // (2) 헬스 체크 쿼리
    try {
      steps.push({ step: "health", message: "running health check..." });
      const health: any = await client.query(
        "SELECT current_database() AS db, current_user AS user"
      );
      steps.push({
        step: "health",
        ok: true,
        result: health?.rows?.[0] ?? null,
      });
    } catch (e: any) {
      steps.push({
        step: "health",
        ok: false,
        error: {
          name: e?.name,
          code: e?.code,
          message: e?.message,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          stage: "health",
          steps,
        },
        { status: 200 }
      );
    }

    // (3) public 스키마 테이블 목록
    try {
      steps.push({ step: "list_tables", message: "listing public tables..." });
      const tables: any = await client.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
        `
      );
      steps.push({
        step: "list_tables",
        ok: true,
        tables: tables?.rows?.map((r: any) => r.table_name) ?? [],
      });
    } catch (e: any) {
      steps.push({
        step: "list_tables",
        ok: false,
        error: {
          name: e?.name,
          code: e?.code,
          message: e?.message,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          stage: "list_tables",
          steps,
        },
        { status: 200 }
      );
    }

    // (4) price_history 1건만 조회
    try {
      steps.push({
        step: "price_history",
        message: "querying price_history...",
      });

      const result: any = await client.query(`
        SELECT
          name,
          price,
          TO_CHAR(date, 'YYYY-MM-DD') AS date
        FROM price_history
        ORDER BY date ASC
        LIMIT 5
      `);

      steps.push({
        step: "price_history",
        ok: true,
        rowCount: result?.rowCount ?? result?.rows?.length ?? 0,
        sample: result?.rows ?? [],
      });

      return NextResponse.json(
        {
          ok: true,
          stage: "done",
          steps,
        },
        { status: 200 }
      );
    } catch (e: any) {
      steps.push({
        step: "price_history",
        ok: false,
        error: {
          name: e?.name,
          code: e?.code,
          message: e?.message,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          stage: "price_history",
          steps,
        },
        { status: 200 }
      );
    }
  } catch (e: any) {
    steps.push({
      step: "unexpected",
      ok: false,
      error: {
        name: e?.name,
        code: e?.code,
        message: e?.message,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        stage: "unexpected",
        steps,
      },
      { status: 200 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
