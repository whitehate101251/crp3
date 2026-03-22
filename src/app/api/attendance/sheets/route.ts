import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AttendanceStatus } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  let query = supabaseAdmin
    .from("attendance_sheets")
    .select("id, foreman_id, site_id, date, in_time, out_time, status, approved_at, created_at")
    .order("date", { ascending: false });

  const status = params.get("status") as AttendanceStatus | null;
  const siteId = params.get("site_id");
  const foremanId = params.get("foreman_id");
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");
  const approvedOn = params.get("approved_on");

  if (status) {
    query = query.eq("status", status);
  }

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  if (foremanId) {
    query = query.eq("foreman_id", foremanId);
  }

  if (date) {
    query = query.eq("date", date);
  }

  if (from) {
    query = query.gte("date", from);
  }

  if (to) {
    query = query.lte("date", to);
  }

  if (approvedOn) {
    const approvedDate = new Date(`${approvedOn}T00:00:00.000Z`);
    if (!Number.isNaN(approvedDate.getTime())) {
      const nextDay = new Date(approvedDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query = query.gte("approved_at", approvedDate.toISOString()).lt("approved_at", nextDay.toISOString());
    }
  }

  if (user.role === "SITE_INCHARGE") {
    if (!user.site_id) {
      return NextResponse.json([]);
    }
    query = query.eq("site_id", user.site_id);
  }

  if (user.role === "FOREMAN") {
    query = query.eq("foreman_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
