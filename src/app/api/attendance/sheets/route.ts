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

export async function DELETE(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const sheetId = String(body.sheet_id ?? "").trim();

    if (!sheetId) {
      return NextResponse.json({ error: "sheet_id is required" }, { status: 400 });
    }

    const { data: existingSheet, error: existingError } = await supabaseAdmin
      .from("attendance_sheets")
      .select("id")
      .eq("id", sheetId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (!existingSheet) {
      return NextResponse.json({ error: "Attendance sheet not found" }, { status: 404 });
    }

    const { error: recordsDeleteError } = await supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("sheet_id", sheetId);

    if (recordsDeleteError) {
      return NextResponse.json({ error: recordsDeleteError.message }, { status: 400 });
    }

    const { error: sheetDeleteError } = await supabaseAdmin
      .from("attendance_sheets")
      .delete()
      .eq("id", sheetId);

    if (sheetDeleteError) {
      return NextResponse.json({ error: sheetDeleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, sheet_id: sheetId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete attendance sheet" }, { status: 400 });
  }
}
