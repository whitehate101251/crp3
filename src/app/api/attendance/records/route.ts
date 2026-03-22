import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { X_MAX, Y_MAX } from "@/lib/constants";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sheetId = new URL(request.url).searchParams.get("sheet_id");
  if (!sheetId) {
    return NextResponse.json({ error: "sheet_id is required" }, { status: 400 });
  }

  const { data: sheet, error: sheetError } = await supabaseAdmin
    .from("attendance_sheets")
    .select("id, foreman_id, site_id")
    .eq("id", sheetId)
    .maybeSingle();

  if (sheetError) {
    return NextResponse.json({ error: sheetError.message }, { status: 500 });
  }

  if (!sheet) {
    return NextResponse.json({ error: "Attendance sheet not found" }, { status: 404 });
  }

  const isAllowed =
    user.role === "ADMIN" ||
    (user.role === "SITE_INCHARGE" && user.site_id === sheet.site_id) ||
    (user.role === "FOREMAN" && user.id === sheet.foreman_id);

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .select("id, sheet_id, worker_id, present, x_value, y_value, total_hours, double_check, created_at")
    .eq("sheet_id", sheetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = data ?? [];
  const workerIds = Array.from(new Set(records.map((record) => record.worker_id)));

  if (!workerIds.length) {
    return NextResponse.json(records);
  }

  const { data: workers, error: workersError } = await supabaseAdmin
    .from("workers")
    .select("id, name")
    .in("id", workerIds);

  if (workersError) {
    return NextResponse.json({ error: workersError.message }, { status: 500 });
  }

  const workerNameById = new Map((workers ?? []).map((worker) => [worker.id, worker.name]));
  const recordsWithNames = records.map((record) => ({
    ...record,
    worker_name: workerNameById.get(record.worker_id) ?? record.worker_id,
  }));

  return NextResponse.json(recordsWithNames);
}

export async function PATCH(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      record_id?: string;
      x_value?: number;
      y_value?: number;
      present?: boolean;
    };

    if (!body.record_id) {
      return NextResponse.json({ error: "record_id is required" }, { status: 400 });
    }

    if ((body.x_value !== undefined && typeof body.x_value !== "number") || (body.y_value !== undefined && typeof body.y_value !== "number")) {
      return NextResponse.json({ error: "x_value and y_value must be numbers" }, { status: 400 });
    }

    const { data: existingRecord, error: existingError } = await supabaseAdmin
      .from("attendance_records")
      .select("id, present, x_value, y_value")
      .eq("id", body.record_id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (!existingRecord) {
      return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    }

    const present = body.present !== undefined ? body.present : existingRecord.present;
    const xValue = body.x_value !== undefined ? body.x_value : existingRecord.x_value;
    const yValue = body.y_value !== undefined ? body.y_value : existingRecord.y_value;

    if (xValue < 0 || xValue > X_MAX || yValue < 0 || yValue > Y_MAX) {
      return NextResponse.json({ error: "X or Y value out of range." }, { status: 400 });
    }

    if (present && xValue === 0 && yValue === 0) {
      return NextResponse.json({ error: "You cannot save this record while status is Present with X=0 and Y=0. Please enter X or Y above 0." }, { status: 400 });
    }

    const finalX = present ? xValue : 0;
    const finalY = present ? yValue : 0;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("attendance_records")
      .update({
        present,
        x_value: finalX,
        y_value: finalY,
      })
      .eq("id", body.record_id)
      .select("id, sheet_id, worker_id, present, x_value, y_value, total_hours, double_check, created_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update attendance record" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { record_id?: string };
    if (!body.record_id) {
      return NextResponse.json({ error: "record_id is required" }, { status: 400 });
    }

    const { data: deleted, error } = await supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("id", body.record_id)
      .select("id, sheet_id, worker_id, present, x_value, y_value, total_hours, double_check, created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!deleted) {
      return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    }

    return NextResponse.json(deleted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete attendance record" },
      { status: 400 },
    );
  }
}
