import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "SITE_INCHARGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!user.site_id) {
    return NextResponse.json({
      pendingReviews: 0,
      foremenCount: 0,
      todayStatus: "No activity yet",
      recentSubmissions: [],
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const [pendingResult, foremenResult, todaySheetsResult] = await Promise.all([
    supabaseAdmin
      .from("attendance_sheets")
      .select("id", { count: "exact", head: true })
      .eq("site_id", user.site_id)
      .eq("status", "SENT_TO_SI"),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "FOREMAN")
      .eq("parent_id", user.id),
    supabaseAdmin
      .from("attendance_sheets")
      .select("id, foreman_id, created_at")
      .eq("site_id", user.site_id)
      .eq("date", today)
      .order("created_at", { ascending: false }),
  ]);

  if (todaySheetsResult.error) {
    return NextResponse.json({ error: todaySheetsResult.error.message }, { status: 500 });
  }

  const foremanIds = [...new Set((todaySheetsResult.data ?? []).map((sheet) => sheet.foreman_id))];
  const { data: foremen } = foremanIds.length
    ? await supabaseAdmin.from("users").select("id, name").in("id", foremanIds)
    : { data: [] as Array<{ id: string; name: string }> };

  const foremanNameById = Object.fromEntries((foremen ?? []).map((entry) => [entry.id, entry.name]));
  const recentSubmissions = (todaySheetsResult.data ?? []).slice(0, 5).map((sheet) => ({
    sheet_id: sheet.id,
    foreman_name: foremanNameById[sheet.foreman_id] ?? sheet.foreman_id,
    submission_time: sheet.created_at,
  }));

  const todayCount = todaySheetsResult.data?.length ?? 0;

  return NextResponse.json({
    pendingReviews: pendingResult.count ?? 0,
    foremenCount: foremenResult.count ?? 0,
    todayStatus: todayCount > 0 ? `${todayCount} submission${todayCount === 1 ? "" : "s"} today` : "No activity yet",
    recentSubmissions,
  });
}
