// app/api/price/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// 🔹 서버 전용 Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL!,          // vercel–supabase 연동으로 생긴 값
  process.env.SUPABASE_ANON_KEY!  // anon key (읽기만 할 거면 이걸로 충분)
);

export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("price_history")
      .select("name, price, date")
      .order("date", { ascending: true });

    if (error) {
      console.error("[/api/price] supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // date 포맷을 클라이언트에서 바꿔도 되고, 여기서 문자열 처리해도 됨
    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/price] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
