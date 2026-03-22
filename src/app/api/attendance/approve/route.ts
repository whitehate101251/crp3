import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
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

    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from("attendance_sheets")
      .select("id, status")
      .eq("id", sheetId)
      .maybeSingle();

    if (sheetError) {
      return NextResponse.json({ error: sheetError.message }, { status: 400 });
    }

    if (!sheet) {
      return NextResponse.json({ error: "Attendance sheet not found." }, { status: 404 });
    }

    if (sheet.status !== "SENT_TO_ADMIN") {
      return NextResponse.json({ error: "Only SENT_TO_ADMIN sheets can be approved." }, { status: 400 });
    }

    const { data: records, error: recordsError } = await supabaseAdmin
      .from("attendance_records")
      .select("id, present, x_value, y_value")
      .eq("sheet_id", sheetId);

    if (recordsError) {
      return NextResponse.json({ error: recordsError.message }, { status: 400 });
    }

    const hasInvalidPresentRecord = (records ?? []).some((record) => record.present && record.x_value === 0 && record.y_value === 0);
    if (hasInvalidPresentRecord) {
      return NextResponse.json({ error: "You cannot approve this sheet. A present worker has X=0 and Y=0. Please correct values first." }, { status: 400 });
    }

    const { data: updatedSheet, error: updateError } = await supabaseAdmin
      .from("attendance_sheets")
      .update({ status: "APPROVED", approved_at: new Date().toISOString() })
      .eq("id", sheetId)
      .select("id, foreman_id, site_id, date, in_time, out_time, status, approved_at, created_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedSheet);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed" }, { status: 400 });
  }
}
