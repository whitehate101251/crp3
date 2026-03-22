import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Worker } from "@/lib/types";

export async function GET(request: Request) {
  const actor = await getRequestSessionUser(request);
  if (!actor || !["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  let query = supabaseAdmin
    .from("workers")
    .select("id, name, father_name, phone_number, aadhar_card, worker_type, foreman_id, site_id, created_at")
    .order("created_at", { ascending: false });

  if (actor.role === "FOREMAN") {
    query = query.eq("foreman_id", actor.id);
  } else if (actor.role === "SITE_INCHARGE") {
    if (!actor.site_id) {
      return NextResponse.json([]);
    }
    query = query.eq("site_id", actor.site_id);
  } else {
    const foremanId = String(params.get("foreman_id") ?? "").trim();
    const siteId = String(params.get("site_id") ?? "").trim();

    if (foremanId) {
      query = query.eq("foreman_id", foremanId);
    }

    if (siteId) {
      query = query.eq("site_id", siteId);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as Worker[]);
}

export async function POST(request: Request) {
  const actor = await getRequestSessionUser(request);
  if (!actor || !["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const fatherName = String(body.father_name ?? "").trim();
  const phoneNumber = String(body.phone_number ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Worker name is required" }, { status: 400 });
  }

  if (!fatherName || !phoneNumber) {
    return NextResponse.json({ error: "father_name and phone_number are required" }, { status: 400 });
  }

  const foremanId = actor.role === "FOREMAN" ? actor.id : String(body.foreman_id ?? "").trim();
  const siteId = actor.role === "FOREMAN" || actor.role === "SITE_INCHARGE" ? actor.site_id ?? "" : String(body.site_id ?? "").trim();

  if (!foremanId || !siteId) {
    return NextResponse.json({ error: "foreman_id and site_id are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("workers")
    .insert({
      name,
      father_name: fatherName,
      phone_number: phoneNumber,
      aadhar_card: body.aadhar_card ? String(body.aadhar_card).trim() : null,
      worker_type: body.worker_type ? String(body.worker_type).trim() : null,
      foreman_id: foremanId,
      site_id: siteId,
    })
    .select("id, name, father_name, phone_number, aadhar_card, worker_type, foreman_id, site_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const worker = data as Worker;

  return NextResponse.json(worker, { status: 201 });
}
