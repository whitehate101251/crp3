import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestSessionUser(request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const updatePayload: Record<string, unknown> = {};
  let nextInchargeId: string | null | undefined;

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Site name is required" }, { status: 400 });
    }
    updatePayload.name = name;
  }

  if (body.location !== undefined) {
    updatePayload.location = body.location ? String(body.location).trim() : null;
  }

  if (body.incharge_id !== undefined) {
    nextInchargeId = body.incharge_id ? String(body.incharge_id) : null;
    updatePayload.incharge_id = nextInchargeId;

    if (nextInchargeId) {
      const { data: incharge, error: inchargeError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", nextInchargeId)
        .eq("role", "SITE_INCHARGE")
        .maybeSingle();

      if (inchargeError) {
        return NextResponse.json({ error: inchargeError.message }, { status: 400 });
      }

      if (!incharge) {
        return NextResponse.json({ error: "Selected incharge does not exist or does not have SITE_INCHARGE role" }, { status: 400 });
      }
    }
  }

  const { data: site, error } = await supabaseAdmin
    .from("sites")
    .update(updatePayload)
    .eq("id", id)
    .select("id, name, location, incharge_id, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  if (nextInchargeId !== undefined) {
    if (nextInchargeId) {
      const { error: clearCurrentBySiteError } = await supabaseAdmin
        .from("users")
        .update({ site_id: null })
        .eq("role", "SITE_INCHARGE")
        .eq("site_id", id)
        .neq("id", nextInchargeId);

      if (clearCurrentBySiteError) {
        return NextResponse.json({ error: clearCurrentBySiteError.message }, { status: 400 });
      }

      const { error: clearTargetOldSiteError } = await supabaseAdmin
        .from("users")
        .update({ site_id: null })
        .eq("role", "SITE_INCHARGE")
        .eq("id", nextInchargeId)
        .neq("site_id", id);

      if (clearTargetOldSiteError) {
        return NextResponse.json({ error: clearTargetOldSiteError.message }, { status: 400 });
      }

      const { error: assignTargetError } = await supabaseAdmin
        .from("users")
        .update({ site_id: id })
        .eq("role", "SITE_INCHARGE")
        .eq("id", nextInchargeId);

      if (assignTargetError) {
        return NextResponse.json({ error: assignTargetError.message }, { status: 400 });
      }
    } else {
      const { error: clearInchargeUserError } = await supabaseAdmin
        .from("users")
        .update({ site_id: null })
        .eq("role", "SITE_INCHARGE")
        .eq("site_id", id);

      if (clearInchargeUserError) {
        return NextResponse.json({ error: clearInchargeUserError.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json(site);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestSessionUser(_request);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const { data: linkedSheet, error: sheetError } = await supabaseAdmin
      .from("attendance_sheets")
      .select("id")
      .eq("site_id", id)
      .limit(1)
      .maybeSingle();

    if (sheetError) {
      return NextResponse.json({ error: sheetError.message }, { status: 400 });
    }

    if (linkedSheet) {
      return NextResponse.json({ error: "Cannot delete site with attendance history." }, { status: 400 });
    }

    const { data: deleted, error } = await supabaseAdmin
      .from("sites")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!deleted) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
