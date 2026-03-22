import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Worker } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getRequestSessionUser(request);
  if (!actor || !["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const { data: targetWorker, error: targetError } = await supabaseAdmin
    .from("workers")
    .select("id, foreman_id, site_id")
    .eq("id", id)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  if (!targetWorker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  if (actor.role === "FOREMAN" && targetWorker.foreman_id !== actor.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (actor.role === "SITE_INCHARGE" && actor.site_id && targetWorker.site_id !== actor.site_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates = {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    father_name: typeof body.father_name === "string" ? body.father_name.trim() : undefined,
    phone_number: typeof body.phone_number === "string" ? body.phone_number.trim() : undefined,
    aadhar_card: typeof body.aadhar_card === "string" ? body.aadhar_card.trim() : body.aadhar_card,
    worker_type: typeof body.worker_type === "string" ? body.worker_type.trim() : body.worker_type,
  };

  const { data, error } = await supabaseAdmin
    .from("workers")
    .update(updates)
    .eq("id", id)
    .select("id, name, father_name, phone_number, aadhar_card, worker_type, foreman_id, site_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as Worker);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getRequestSessionUser(_request);
  if (!actor || !["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const { data: targetWorker, error: targetError } = await supabaseAdmin
    .from("workers")
    .select("id, foreman_id, site_id")
    .eq("id", id)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  if (!targetWorker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  if (actor.role === "FOREMAN" && targetWorker.foreman_id !== actor.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (actor.role === "SITE_INCHARGE" && actor.site_id && targetWorker.site_id !== actor.site_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("workers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
