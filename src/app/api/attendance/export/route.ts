import { NextResponse } from "next/server";
import { addDays, format, isValid, parseISO } from "date-fns";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PivotRow = {
  name: string;
  values: Record<string, number | null>;
};

function getDateRange(from: string, to: string) {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  if (!isValid(fromDate) || !isValid(toDate)) {
    return { error: "Invalid date range", dates: [] as string[] };
  }

  if (fromDate > toDate) {
    return { error: "From date cannot be after To date", dates: [] as string[] };
  }

  const dates: string[] = [];
  for (let current = fromDate; current <= toDate; current = addDays(current, 1)) {
    dates.push(format(current, "yyyy-MM-dd"));
  }

  if (dates.length > 92) {
    return { error: "Please select a date range up to 92 days", dates: [] as string[] };
  }

  return { error: null, dates };
}

export async function GET(request: Request) {
  const actor = await getRequestSessionUser(request);
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const from = String(params.get("from") ?? "").trim();
  const to = String(params.get("to") ?? "").trim();
  const foremanId = String(params.get("foreman_id") ?? "").trim();

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const { error: rangeError, dates } = getDateRange(from, to);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  let sheetsQuery = supabaseAdmin
    .from("attendance_sheets")
    .select("id, foreman_id, site_id, date")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (foremanId) {
    sheetsQuery = sheetsQuery.eq("foreman_id", foremanId);
  }

  const { data: sheets, error: sheetsError } = await sheetsQuery;
  if (sheetsError) {
    return NextResponse.json({ error: sheetsError.message }, { status: 500 });
  }

  const sheetRows = sheets ?? [];
  const sheetIds = sheetRows.map((sheet) => sheet.id);
  const workerHoursById = new Map<string, Record<string, number>>();
  const workerIdSet = new Set<string>();

  if (sheetIds.length > 0) {
    const { data: records, error: recordsError } = await supabaseAdmin
      .from("attendance_records")
      .select("worker_id, total_hours, sheet_id")
      .in("sheet_id", sheetIds);

    if (recordsError) {
      return NextResponse.json({ error: recordsError.message }, { status: 500 });
    }

    const sheetById = new Map(sheetRows.map((sheet) => [sheet.id, sheet]));

    for (const record of records ?? []) {
      const sheet = sheetById.get(record.sheet_id);
      if (!sheet) continue;

      workerIdSet.add(record.worker_id);
      const existing = workerHoursById.get(record.worker_id) ?? {};
      existing[sheet.date] = (existing[sheet.date] ?? 0) + Number(record.total_hours ?? 0);
      workerHoursById.set(record.worker_id, existing);
    }
  }

  const workerIds = [...workerIdSet];
  let workerNameById = new Map<string, string>();

  if (workerIds.length > 0) {
    const { data: workers, error: workersError } = await supabaseAdmin
      .from("workers")
      .select("id, name")
      .in("id", workerIds);

    if (workersError) {
      return NextResponse.json({ error: workersError.message }, { status: 500 });
    }

    workerNameById = new Map((workers ?? []).map((worker) => [worker.id, worker.name]));
  }

  const pivotRows: PivotRow[] = workerIds
    .map((workerId) => {
      const valuesByDate = workerHoursById.get(workerId) ?? {};
      const values: Record<string, number | null> = {};
      for (const date of dates) {
        values[date] = valuesByDate[date] ?? null;
      }

      return {
        name: workerNameById.get(workerId) ?? workerId,
        values,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const uniqueSiteIds = [...new Set(sheetRows.map((sheet) => sheet.site_id).filter(Boolean))];
  let siteName = "N/A";
  let siteInchargeName = "N/A";

  if (uniqueSiteIds.length === 1) {
    const siteId = uniqueSiteIds[0];

    const [{ data: siteData, error: siteError }, { data: inchargeData, error: inchargeError }] = await Promise.all([
      supabaseAdmin.from("sites").select("id, name").eq("id", siteId).maybeSingle(),
      supabaseAdmin.from("users").select("name").eq("role", "SITE_INCHARGE").eq("site_id", siteId),
    ]);

    if (siteError) {
      return NextResponse.json({ error: siteError.message }, { status: 500 });
    }

    if (inchargeError) {
      return NextResponse.json({ error: inchargeError.message }, { status: 500 });
    }

    siteName = siteData?.name ?? "N/A";
    const names = (inchargeData ?? []).map((entry) => entry.name).filter(Boolean);
    siteInchargeName = names.length ? names.join(", ") : "Unassigned";
  } else if (uniqueSiteIds.length > 1) {
    siteName = "Multiple Sites";
    siteInchargeName = "Multiple Site Incharges";
  }

  let foremanName = "All Foremen";
  if (foremanId) {
    const { data: foreman, error: foremanError } = await supabaseAdmin
      .from("users")
      .select("id, name, site_id")
      .eq("id", foremanId)
      .eq("role", "FOREMAN")
      .maybeSingle();

    if (foremanError) {
      return NextResponse.json({ error: foremanError.message }, { status: 500 });
    }

    if (!foreman) {
      return NextResponse.json({ error: "Selected foreman not found" }, { status: 404 });
    }

    foremanName = foreman.name;

    if (siteName === "N/A" && foreman.site_id) {
      const [{ data: siteData }, { data: inchargeData }] = await Promise.all([
        supabaseAdmin.from("sites").select("name").eq("id", foreman.site_id).maybeSingle(),
        supabaseAdmin.from("users").select("name").eq("role", "SITE_INCHARGE").eq("site_id", foreman.site_id),
      ]);

      siteName = siteData?.name ?? siteName;
      const names = (inchargeData ?? []).map((entry) => entry.name).filter(Boolean);
      siteInchargeName = names.length ? names.join(", ") : siteInchargeName;
    }
  }

  return NextResponse.json({
    from,
    to,
    dates,
    rows: pivotRows,
    footer: {
      foremanName,
      siteInchargeName,
      siteName,
    },
  });
}