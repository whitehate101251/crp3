import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getRequestSessionUser(request);
  if (!actor || !["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;

  if (actor.role !== "ADMIN" && actor.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updatePayload.name = String(body.name).trim();
    }

    if (body.phone !== undefined) {
      updatePayload.phone = body.phone ? String(body.phone).trim() : null;
    }

    if (body.father_name !== undefined) {
      updatePayload.father_name = body.father_name ? String(body.father_name).trim() : null;
    }

    if (actor.role === "ADMIN") {
      if (body.username !== undefined) {
        updatePayload.username = String(body.username).trim();
      }

      if (body.password !== undefined && body.password.trim().length >= 8) {
        updatePayload.password_hash = await hash(body.password, 10);
      }

      if (body.site_id !== undefined) {
        updatePayload.site_id = body.site_id ? String(body.site_id) : null;
      }

      if (body.parent_id !== undefined) {
        updatePayload.parent_id = body.parent_id ? String(body.parent_id) : null;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", id)
      .select("id, auth_id, username, name, father_name, role, phone, site_id, parent_id, created_at")
      .single();

    if (error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getRequestSessionUser(_request);
  if (!actor || !["ADMIN", "SITE_INCHARGE"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;

  if (actor.role === "ADMIN" && actor.id === id) {
    return NextResponse.json({ error: "Admin cannot delete own account" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
