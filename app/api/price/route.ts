// app/api/price/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// 🔹 요청이 들어왔을 때만 Supabase 클라이언트를 만든다
export async function GET(_req: NextRequest) {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1) 빌드 시점이 아니라, 요청 시점에 env를 체크
  if (!url || !anonKey) {
    console.error("[/api/price] ❌ Supabase env not set", {
      hasUrl: !!url,
      hasAnonKey: !!anonKey,
    });

    return NextResponse.json(
      {
        error:
          "Supabase URL or ANON KEY is not configured on the server. Check SUPABASE_URL / SUPABASE_ANON_KEY.",
      },
      { status: 500 }
    );
  }

  // 2) 여기서만 createClient 호출 (env가 있는 걸 확인한 뒤)
  const supabase = createClient(url, anonKey);

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

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/price] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
