import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SIAttendanceEntry } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const siteId = params.get("site_id");
  const from = params.get("from");
  const to = params.get("to");
  const siUserId = params.get("si_user_id");

  if (date) {
    let usersQuery = supabaseAdmin
      .from("users")
      .select("id, name, father_name, phone, site_id")
      .eq("role", "SITE_INCHARGE");

    if (siteId) {
      usersQuery = usersQuery.eq("site_id", siteId);
    }

    if (siUserId) {
      usersQuery = usersQuery.eq("id", siUserId);
    }

    const { data: siteIncharges, error: usersError } = await usersQuery;
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    let attendanceQuery = supabaseAdmin
      .from("si_attendance_entries")
      .select("id, si_user_id, site_id, date, name, father_name, phone_number, status, source_sheet_id, created_at")
      .eq("date", date);

    if (siteId) {
      attendanceQuery = attendanceQuery.eq("site_id", siteId);
    }

    if (siUserId) {
      attendanceQuery = attendanceQuery.eq("si_user_id", siUserId);
    }

    const { data: entries, error: entriesError } = await attendanceQuery;

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    const entryBySi = new Map((entries ?? []).map((entry) => [entry.si_user_id, entry]));

    const rows: SIAttendanceEntry[] = (siteIncharges ?? []).map((siteIncharge) => {
      const existing = entryBySi.get(siteIncharge.id);
      if (existing) {
        return existing as SIAttendanceEntry;
      }

      return {
        id: `si-attendance-absent-${siteIncharge.id}-${date}`,
        si_user_id: siteIncharge.id,
        site_id: siteIncharge.site_id,
        date,
        name: siteIncharge.name,
        father_name: siteIncharge.father_name ?? null,
        phone_number: siteIncharge.phone ?? null,
        status: "ABSENT",
        source_sheet_id: null,
        created_at: new Date().toISOString(),
      };
    });

    return NextResponse.json(rows);
  }

  let query = supabaseAdmin
    .from("si_attendance_entries")
    .select("id, si_user_id, site_id, date, name, father_name, phone_number, status, source_sheet_id, created_at")
    .order("date", { ascending: false });

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  if (siUserId) {
    query = query.eq("si_user_id", siUserId);
  }

  if (from) {
    query = query.gte("date", from);
  }

  if (to) {
    query = query.lte("date", to);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as SIAttendanceEntry[]);
}

export async function PATCH(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { si_user_id, date, status } = body;

  if (!si_user_id || !date || !status) {
    return NextResponse.json(
      { error: "Missing required fields: si_user_id, date, status" },
      { status: 400 }
    );
  }

  if (!["PRESENT", "ABSENT"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be PRESENT or ABSENT" },
      { status: 400 }
    );
  }

  // Verify SI user exists and has role SITE_INCHARGE
  const { data: siUser, error: siUserError } = await supabaseAdmin
    .from("users")
    .select("id, name, father_name, phone, site_id")
    .eq("id", si_user_id)
    .eq("role", "SITE_INCHARGE")
    .single();

  if (siUserError || !siUser) {
    return NextResponse.json(
      { error: "SI user not found or invalid role" },
      { status: 404 }
    );
  }

  // Check if entry already exists to preserve source_sheet_id
  const { data: existingEntry } = await supabaseAdmin
    .from("si_attendance_entries")
    .select("source_sheet_id")
    .eq("si_user_id", si_user_id)
    .eq("date", date)
    .single();

  const { data: upsertedEntry, error: upsertError } = await supabaseAdmin
    .from("si_attendance_entries")
    .upsert(
      {
        si_user_id,
        date,
        status,
        site_id: siUser.site_id,
        name: siUser.name,
        father_name: siUser.father_name ?? null,
        phone_number: siUser.phone ?? null,
        source_sheet_id: existingEntry?.source_sheet_id ?? null,
      },
      { onConflict: "si_user_id,date" }
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(upsertedEntry as SIAttendanceEntry);
}
