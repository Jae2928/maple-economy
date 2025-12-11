// app/api/notice/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[/api/notice] ❌ Supabase env not set", {
      hasUrl: !!url,
      hasAnonKey: !!anonKey,
    });
    throw new Error(
      "Supabase URL or ANON KEY is not configured on the server. Check SUPABASE_URL / SUPABASE_ANON_KEY."
    );
  }

  return createClient(url, anonKey);
}

// 🔹 GET /api/notice
export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("notice")
      .select("id, category, title, content, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[/api/notice] supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 기존 쿼리에서 했던 것처럼 created_at -> "YYYY-MM-DD HH:MM" 포맷으로 변환
    const rows =
      (data ?? []).map((row: any) => {
        const d = row.created_at ? new Date(row.created_at) : null;

        const createdAt =
          d != null
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                2,
                "0"
              )}-${String(d.getDate()).padStart(2, "0")} ${String(
                d.getHours()
              ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
            : null;

        return {
          id: row.id,
          type: row.category as string, // 'NEWS' | 'UPDATE' | 'NOTICE'
          title: row.title as string,
          content: row.content as string,
          createdAt, // "YYYY-MM-DD HH:MM"
        };
      });

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/notice] unexpected error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
