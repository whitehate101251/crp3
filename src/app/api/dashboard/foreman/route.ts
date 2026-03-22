import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "FOREMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const [{ count: workersCount }, sheetResult] = await Promise.all([
    supabaseAdmin.from("workers").select("id", { count: "exact", head: true }).eq("foreman_id", user.id),
    supabaseAdmin
      .from("attendance_sheets")
      .select("status")
      .eq("foreman_id", user.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  if (sheetResult.error) {
    return NextResponse.json({ error: sheetResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    workersCount: workersCount ?? 0,
    todaySheetStatus: sheetResult.data?.status ?? "NOT_STARTED",
  });
}
