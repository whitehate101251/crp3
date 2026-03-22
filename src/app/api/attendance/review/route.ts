import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { X_MAX, Y_MAX } from "@/lib/constants";

export async function PATCH(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "SITE_INCHARGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const sheetId = String(body.sheet_id ?? "").trim();
    const updates = Array.isArray(body.records) ? body.records : [];

    if (!sheetId) {
      return NextResponse.json({ error: "sheet_id is required" }, { status: 400 });
    }

    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from("attendance_sheets")
      .select("id, site_id, date, status")
      .eq("id", sheetId)
      .maybeSingle();

    if (sheetError) {
      return NextResponse.json({ error: sheetError.message }, { status: 400 });
    }

    if (!sheet) {
      return NextResponse.json({ error: "Attendance sheet not found." }, { status: 404 });
    }

    if (!user.site_id || sheet.site_id !== user.site_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sheet.status !== "SENT_TO_SI") {
      return NextResponse.json({ error: "Only SENT_TO_SI sheets can be forwarded." }, { status: 400 });
    }

    for (const update of updates) {
      const present = Boolean(update.present);
      const xValue = Number(update.x_value ?? 0);
      const yValue = Number(update.y_value ?? 0);

      if (xValue < 0 || xValue > X_MAX || yValue < 0 || yValue > Y_MAX) {
        return NextResponse.json({ error: "X or Y value out of range." }, { status: 400 });
      }

      if (present && xValue === 0 && yValue === 0) {
        return NextResponse.json({ error: "You cannot forward this sheet. A present worker has X=0 and Y=0. Please enter X or Y above 0." }, { status: 400 });
      }

      const { error: updateError } = await supabaseAdmin
        .from("attendance_records")
        .update({
          present,
          x_value: present ? xValue : 0,
          y_value: present ? yValue : 0,
          double_check: Boolean(update.double_check),
        })
        .eq("id", String(update.id ?? ""))
        .eq("sheet_id", sheetId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    const { data: updatedSheet, error: statusError } = await supabaseAdmin
      .from("attendance_sheets")
      .update({ status: "SENT_TO_ADMIN" })
      .eq("id", sheetId)
      .select("id, foreman_id, site_id, date, in_time, out_time, status, created_at")
      .single();

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 400 });
    }

    const { data: siUser } = await supabaseAdmin
      .from("users")
      .select("id, name, father_name, phone, site_id")
      .eq("id", user.id)
      .maybeSingle();

    await supabaseAdmin.from("si_attendance_entries").upsert(
      {
        si_user_id: user.id,
        site_id: user.site_id,
        date: sheet.date,
        name: siUser?.name ?? "Site Incharge",
        father_name: siUser?.father_name ?? null,
        phone_number: siUser?.phone ?? null,
        status: "PRESENT",
        source_sheet_id: sheetId,
      },
      { onConflict: "si_user_id,date" },
    );

    return NextResponse.json(updatedSheet);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 400 });
  }
}
