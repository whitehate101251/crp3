import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { X_MAX, Y_MAX } from "@/lib/constants";

type SubmitRecordInput = {
  worker_id: string;
  present: boolean;
  x_value: number;
  y_value: number;
};

export async function POST(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "FOREMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const records: SubmitRecordInput[] = Array.isArray(body.records) ? body.records : [];
    const date = String(body.date ?? "").trim();

    if (!user.site_id) {
      return NextResponse.json({ error: "Foreman site is not assigned." }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    for (const record of records) {
      if (record.x_value < 0 || record.x_value > X_MAX || record.y_value < 0 || record.y_value > Y_MAX) {
        return NextResponse.json({ error: "X or Y value out of range." }, { status: 400 });
      }

      if (record.present && record.x_value === 0 && record.y_value === 0) {
        return NextResponse.json({ error: "You cannot submit this attendance. A present worker has X=0 and Y=0. Please enter X or Y above 0." }, { status: 400 });
      }
    }

    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from("attendance_sheets")
      .insert({
        foreman_id: user.id,
        site_id: user.site_id,
        date,
        in_time: body.in_time ?? null,
        out_time: body.out_time ?? null,
        status: "SENT_TO_SI",
      })
      .select("id, foreman_id, site_id, date, in_time, out_time, status, created_at")
      .single();

    if (sheetError) {
      if (sheetError.code === "23505") {
        return NextResponse.json({ error: "Attendance for this foreman and date already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: sheetError.message }, { status: 400 });
    }

    const recordPayload = records.map((record) => ({
      sheet_id: sheet.id,
      worker_id: String(record.worker_id),
      present: Boolean(record.present),
      x_value: record.present ? Number(record.x_value) : 0,
      y_value: record.present ? Number(record.y_value) : 0,
      double_check: false,
    }));

    const { data: insertedRecords, error: recordsError } = await supabaseAdmin
      .from("attendance_records")
      .insert(recordPayload)
      .select("id, sheet_id, worker_id, present, x_value, y_value, total_hours, double_check, created_at");

    if (recordsError) {
      await supabaseAdmin.from("attendance_sheets").delete().eq("id", sheet.id);
      return NextResponse.json({ error: recordsError.message }, { status: 400 });
    }

    const result = {
      sheet,
      records: insertedRecords ?? [],
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submit failed" }, { status: 400 });
  }
}
