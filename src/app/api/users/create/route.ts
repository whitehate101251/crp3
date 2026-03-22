import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export async function POST(request: Request) {
  const actor = await getRequestSessionUser(request);
  if (!actor || !["ADMIN", "SITE_INCHARGE"].includes(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const username = String(body?.username ?? "").trim();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const password = String(body?.password ?? "");
    const role = String(body?.role ?? "") as UserRole;
    const siteId = body?.site_id ? String(body.site_id) : null;
    const parentId = body?.parent_id ? String(body.parent_id) : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    if (!["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(role)) {
      return NextResponse.json({ error: "Valid role is required." }, { status: 400 });
    }

    if (!password || password.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (actor.role === "SITE_INCHARGE") {
      if (role !== "FOREMAN") {
        return NextResponse.json({ error: "Site incharge can only create foreman users." }, { status: 403 });
      }

      if (!actor.site_id) {
        return NextResponse.json({ error: "Site incharge is not assigned to a site." }, { status: 400 });
      }
    }

    const passwordHash = await hash(password, 10);

    const fatherName = body?.father_name ? String(body.father_name).trim() : null;

    const insertPayload = {
      username,
      name,
      father_name: fatherName,
      role,
      phone,
      site_id: actor.role === "SITE_INCHARGE" ? actor.site_id : siteId,
      parent_id: actor.role === "SITE_INCHARGE" ? actor.id : parentId,
      password_hash: passwordHash,
    };

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert(insertPayload)
      .select("id, auth_id, username, name, father_name, role, phone, site_id, parent_id, created_at")
      .single();

    if (error) {
      const normalizedMessage = error.message.toLowerCase();
      if (normalizedMessage.includes("duplicate") || normalizedMessage.includes("unique")) {
        return NextResponse.json({ error: "Username already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Create failed" }, { status: 400 });
  }
}
