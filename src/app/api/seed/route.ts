import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SEED_USERS = [
  {
    username: "admin",
    name: "Project Admin",
    password: "admin123",
    role: "ADMIN",
    phone: "9999999999",
  },
  {
    username: "si1",
    name: "Rahul Site Incharge",
    password: "si123",
    role: "SITE_INCHARGE",
    phone: "8888888888",
  },
  {
    username: "foreman1",
    name: "Mahesh Foreman",
    password: "foreman123",
    role: "FOREMAN",
    phone: "7777777777",
  },
];

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Seed endpoint only available in development" }, { status: 403 });
  }

  try {
    console.log("Starting database seed...");
    const today = new Date().toISOString().slice(0, 10);

    const { data: existingSite, error: siteLookupError } = await supabaseAdmin
      .from("sites")
      .select("id")
      .eq("name", "Metro Tower Phase 1")
      .maybeSingle();

    if (siteLookupError) {
      return NextResponse.json({ error: `Failed to lookup site: ${siteLookupError.message}` }, { status: 500 });
    }

    let siteId = existingSite?.id ?? null;

    if (!siteId) {
      const { data: createdSite, error: siteCreateError } = await supabaseAdmin
        .from("sites")
        .insert({
          name: "Metro Tower Phase 1",
          location: "Noida Sector 62",
        })
        .select("id")
        .single();

      if (siteCreateError || !createdSite?.id) {
        return NextResponse.json({ error: `Failed to create site: ${siteCreateError?.message ?? "unknown error"}` }, { status: 500 });
      }

      siteId = createdSite.id;
    }

    if (!siteId) {
      return NextResponse.json({ error: "Failed to resolve site id" }, { status: 500 });
    }

    const adminHash = await hash(SEED_USERS[0].password, 10);
    const siHash = await hash(SEED_USERS[1].password, 10);
    const foremanHash = await hash(SEED_USERS[2].password, 10);

    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from("users")
      .upsert({
        username: SEED_USERS[0].username,
        name: SEED_USERS[0].name,
        role: SEED_USERS[0].role,
        password_hash: adminHash,
        site_id: null,
        parent_id: null,
        phone: SEED_USERS[0].phone,
      }, { onConflict: "username" })
      .select("id")
      .single();

    if (adminError || !adminUser?.id) {
      return NextResponse.json({ error: `Failed to create user ${SEED_USERS[0].username}: ${adminError?.message ?? "unknown error"}` }, { status: 500 });
    }

    const { data: siteIncharge, error: siError } = await supabaseAdmin
      .from("users")
      .upsert({
        username: SEED_USERS[1].username,
        name: SEED_USERS[1].name,
        role: SEED_USERS[1].role,
        password_hash: siHash,
        site_id: siteId,
        parent_id: null,
        phone: SEED_USERS[1].phone,
      }, { onConflict: "username" })
      .select("id")
      .single();

    if (siError || !siteIncharge?.id) {
      return NextResponse.json({ error: `Failed to create user ${SEED_USERS[1].username}: ${siError?.message ?? "unknown error"}` }, { status: 500 });
    }

    const { data: foreman, error: foremanError } = await supabaseAdmin
      .from("users")
      .upsert({
        username: SEED_USERS[2].username,
        name: SEED_USERS[2].name,
        role: SEED_USERS[2].role,
        password_hash: foremanHash,
        site_id: siteId,
        parent_id: siteIncharge.id,
        phone: SEED_USERS[2].phone,
      }, { onConflict: "username" })
      .select("id, site_id")
      .single();

    if (foremanError || !foreman?.id || !foreman.site_id) {
      return NextResponse.json({ error: `Failed to create user ${SEED_USERS[2].username}: ${foremanError?.message ?? "unknown error"}` }, { status: 500 });
    }

    const { error: siteUpdateError } = await supabaseAdmin
      .from("sites")
      .update({ incharge_id: siteIncharge.id })
      .eq("id", siteId);

    if (siteUpdateError) {
      return NextResponse.json({ error: `Failed to assign site incharge: ${siteUpdateError.message}` }, { status: 500 });
    }

    const workersToSeed = [
      { name: "Aman", father_name: "Ramesh", phone_number: "9000000001", worker_type: "Mason" },
      { name: "Ravi", father_name: "Suresh", phone_number: "9000000002", worker_type: "Helper" },
      { name: "Sohan", father_name: "Mohan", phone_number: "9000000003", worker_type: "Electrician" },
    ];

    const { data: existingWorkers, error: existingWorkersError } = await supabaseAdmin
      .from("workers")
      .select("id, name")
      .eq("foreman_id", foreman.id)
      .eq("site_id", foreman.site_id)
      .in("name", workersToSeed.map((worker) => worker.name));

    if (existingWorkersError) {
      return NextResponse.json({ error: `Failed to lookup workers: ${existingWorkersError.message}` }, { status: 500 });
    }

    const existingNames = new Set((existingWorkers ?? []).map((worker) => worker.name));
    const workersToInsert = workersToSeed
      .filter((worker) => !existingNames.has(worker.name))
      .map((worker) => ({
        name: worker.name,
        father_name: worker.father_name,
        phone_number: worker.phone_number,
        aadhar_card: null,
        worker_type: worker.worker_type,
        foreman_id: foreman.id,
        site_id: foreman.site_id,
      }));

    if (workersToInsert.length > 0) {
      const { error: workersInsertError } = await supabaseAdmin
        .from("workers")
        .insert(workersToInsert);

      if (workersInsertError) {
        return NextResponse.json({ error: `Failed to seed workers: ${workersInsertError.message}` }, { status: 500 });
      }
    }

    const { data: sheet, error: sheetError } = await supabaseAdmin.from("attendance_sheets").upsert(
      {
        foreman_id: foreman.id,
        site_id: foreman.site_id,
        date: today,
        in_time: "09:00",
        out_time: "18:00",
        status: "SENT_TO_ADMIN",
      },
      { onConflict: "foreman_id,date" },
    )
    .select("id")
    .single();

    if (sheetError || !sheet?.id) {
      return NextResponse.json({ error: `Failed to seed attendance sheet: ${sheetError?.message ?? "unknown error"}` }, { status: 500 });
    }

    const { data: seededWorkers, error: seededWorkersError } = await supabaseAdmin
      .from("workers")
      .select("id, name")
      .eq("foreman_id", foreman.id)
      .eq("site_id", foreman.site_id)
      .in("name", workersToSeed.map((worker) => worker.name));

    if (seededWorkersError || !seededWorkers || seededWorkers.length === 0) {
      return NextResponse.json({ error: `Failed to fetch seeded workers: ${seededWorkersError?.message ?? "unknown error"}` }, { status: 500 });
    }

    const workerIdByName = Object.fromEntries(seededWorkers.map((worker) => [worker.name, worker.id]));

    const { error: recordsError } = await supabaseAdmin.from("attendance_records").upsert(
      [
        { worker_name: "Aman", present: true, x_value: 1, y_value: 0 },
        { worker_name: "Ravi", present: true, x_value: 1, y_value: 2 },
        { worker_name: "Sohan", present: false, x_value: 0, y_value: 0 },
      ].map((record) => ({
        sheet_id: sheet.id,
        worker_id: workerIdByName[record.worker_name],
        present: record.present,
        x_value: record.present ? record.x_value : 0,
        y_value: record.present ? record.y_value : 0,
        double_check: true,
      })),
      { onConflict: "sheet_id,worker_id" },
    );

    if (recordsError) {
      return NextResponse.json({ error: `Failed to seed attendance records: ${recordsError.message}` }, { status: 500 });
    }

    console.log("✅ Database seed completed successfully!");
    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      users: SEED_USERS.map((u) => ({ username: u.username })),
      seeded: {
        sites: 1,
        workers: 3,
        attendance_sheets: 1,
        attendance_records: 3,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
