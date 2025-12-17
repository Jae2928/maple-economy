// app/api/challenger_price/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// 🔹 서버 전용 Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL!, // vercel–supabase 연동으로 생긴 값
  process.env.SUPABASE_ANON_KEY! // anon key (읽기만 할 거면 이걸로 충분)
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate"); // YYYY-MM-DD
    const endDate = searchParams.get("endDate"); // YYYY-MM-DD
    const namesParam = searchParams.get("names"); // "아이템1,아이템2,..."

    // ✅ challenger_price_history 테이블로 조회
    let query = supabase.from("challenger_price_history").select("name, price, date");

    // 🔹 날짜 범위 필터 (있을 때만 적용)
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    // 🔹 name IN (...) 필터 (있을 때만 적용)
    if (namesParam) {
      const names = namesParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (names.length > 0) {
        query = query.in("name", names);
      }
    }

    // 🔹 날짜 기준 정렬 (오래된 → 최신)
    query = query.order("date", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("[/api/challenger_price] supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/challenger_price] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
