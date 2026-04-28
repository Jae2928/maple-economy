// app/api/price/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// 🔹 서버 전용 Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 프론트에서 넘어온 값은 참고만 하고, 실제로는 덮어씀
    let startDate = searchParams.get("startDate");
    let endDate = searchParams.get("endDate");
    const namesParam = searchParams.get("names");

    // 항상 DB 기준 최신 날짜 조회
    const { data: latestRow, error: latestError } = await supabase
      .from("price_history")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (latestError) {
      console.error("[/api/price] latest date fetch error:", latestError);
      return NextResponse.json(
        { error: latestError.message },
        { status: 500 }
      );
    }

    if (!latestRow?.date) {
      return NextResponse.json(
        { error: "No data in price_history table" },
        { status: 500 }
      );
    }

    // DB 최신 날짜 기준으로 강제 설정
    const latest = new Date(latestRow.date);
    const prev = new Date(latest);
    prev.setDate(prev.getDate() - 7); // 최근 8일 (포함)

    startDate = prev.toISOString().slice(0, 10);
    endDate = latest.toISOString().slice(0, 10);

    console.log("[/api/price] final date range:", startDate, "~", endDate);

    // 기본 쿼리
    let query = supabase
      .from("price_history")
      .select("name, price, date");

    // 🔹 날짜 필터 (무조건 적용됨)
    query = query.gte("date", startDate).lte("date", endDate);

    // 🔹 name IN (...) 필터
    if (namesParam) {
      const names = namesParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (names.length > 0) {
        query = query.in("name", names);
      }
    }

    // 날짜 오름차순 정렬
    query = query.order("date", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("[/api/price] supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/price] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
