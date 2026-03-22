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
