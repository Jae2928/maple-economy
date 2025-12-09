// app/api/etc/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[/api/etc] ❌ Supabase env not set", {
      hasUrl: !!url,
      hasAnonKey: !!anonKey,
    });
    throw new Error(
      "Supabase URL or ANON KEY is not configured on the server. Check SUPABASE_URL / SUPABASE_ANON_KEY."
    );
  }

  return createClient(url, anonKey);
}

// 🔹 GET /api/etc?item=메소%20마켓
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const item = searchParams.get("item") ?? "메소 마켓"; // 기존 기본값 유지

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("etc")
      .select("date, price, name")
      .eq("name", item)
      .order("date", { ascending: true });

    if (error) {
      console.error("[/api/etc] supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // date를 "YYYY-MM-DD" 문자열로 맞춰주기
    type Row = { date: string; price: number };
    const points: Row[] = (data ?? []).map((row: any) => {
      const d = row.date ? new Date(row.date) : null;

      const dateStr =
        d != null
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              "0"
            )}-${String(d.getDate()).padStart(2, "0")}`
          : String(row.date ?? "");

      return {
        date: dateStr,
        price: row.price as number,
      };
    });

    let todayPrice: number | null = null;
    let changePercent: number | null = null;

    if (points.length > 0) {
      todayPrice = points[points.length - 1].price;
      if (points.length > 1) {
        const prev = points[points.length - 2].price;
        if (prev > 0) {
          changePercent = ((todayPrice - prev) / prev) * 100;
        }
      }
    }

    return NextResponse.json(
      {
        item,
        points,
        todayPrice,
        changePercent,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[/api/etc] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "market query error" },
      { status: 500 }
    );
  }
}
