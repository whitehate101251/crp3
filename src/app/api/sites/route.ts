import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || !["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let query = supabaseAdmin
    .from("sites")
    .select("id, name, location, incharge_id, created_at")
    .order("created_at", { ascending: false });

  if (user.role === "SITE_INCHARGE" || user.role === "FOREMAN") {
    if (!user.site_id) {
      return NextResponse.json([]);
    }
    query = query.eq("id", user.site_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Site name is required" }, { status: 400 });
  }

  const inchargeId = body.incharge_id ? String(body.incharge_id) : null;

  if (inchargeId) {
    const { data: incharge, error: inchargeError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", inchargeId)
      .eq("role", "SITE_INCHARGE")
      .maybeSingle();

    if (inchargeError) {
      return NextResponse.json({ error: inchargeError.message }, { status: 400 });
    }

    if (!incharge) {
      return NextResponse.json({ error: "Selected incharge does not exist or does not have SITE_INCHARGE role" }, { status: 400 });
    }
  }

  const { data: site, error } = await supabaseAdmin
    .from("sites")
    .insert({
      name,
      location: body.location ? String(body.location).trim() : null,
      incharge_id: inchargeId,
    })
    .select("id, name, location, incharge_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (inchargeId && site?.id) {
    const { error: userUpdateError } = await supabaseAdmin
      .from("users")
      .update({ site_id: site.id })
      .eq("id", inchargeId)
      .eq("role", "SITE_INCHARGE");

    if (userUpdateError) {
      return NextResponse.json({ error: userUpdateError.message }, { status: 400 });
    }
  }

  return NextResponse.json(site, { status: 201 });
}
