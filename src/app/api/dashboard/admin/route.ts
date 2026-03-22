import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [{ count: totalSites }, { count: totalWorkers }, { count: pendingApprovals }, recentResult] = await Promise.all([
    supabaseAdmin.from("sites").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("workers").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("attendance_sheets").select("id", { count: "exact", head: true }).eq("status", "SENT_TO_ADMIN"),
    supabaseAdmin
      .from("attendance_sheets")
      .select("id, foreman_id, site_id, date, in_time, out_time, status, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (recentResult.error) {
    return NextResponse.json({ error: recentResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    totalSites: totalSites ?? 0,
    totalWorkers: totalWorkers ?? 0,
    pendingApprovals: pendingApprovals ?? 0,
    recentSubmissions: recentResult.data ?? [],
  });
}
