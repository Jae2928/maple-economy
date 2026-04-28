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

    let startDate = searchParams.get("startDate"); // YYYY-MM-DD
    let endDate = searchParams.get("endDate");     // YYYY-MM-DD
    const namesParam = searchParams.get("names");  // "아이템1,아이템2,..."

    //startDate / endDate 둘 다 없으면 → DB 최신 날짜 기준으로 7일 계산
    if (!startDate && !endDate) {
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

      if (latestRow?.date) {
        const latest = new Date(latestRow.date);
        const prev = new Date(latest);
        prev.setDate(prev.getDate() - 6); // 최근 7일 (포함)

        startDate = prev.toISOString().slice(0, 10);
        endDate = latest.toISOString().slice(0, 10);
      }
    }

    // 기본 쿼리
    let query = supabase
      .from("price_history")
      .select("name, price, date");

    // 🔹 날짜 범위 필터
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

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

    //날짜 기준 정렬 (오래된 → 최신)
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
