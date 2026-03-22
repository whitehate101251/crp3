import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || !["ADMIN", "SITE_INCHARGE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string; confirmPassword?: string };

    if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
      return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: "New password and confirm password must match" }, { status: 400 });
    }

    if (body.newPassword.trim().length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("password_hash")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError || !existingUser?.password_hash) {
      return NextResponse.json({ error: "Unable to validate current password" }, { status: 400 });
    }

    const isCurrentValid = await compare(body.currentPassword, existingUser.password_hash);

    if (!isCurrentValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const newHash = await hash(body.newPassword, 10);

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ password_hash: newHash })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Password update failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password update failed" }, { status: 400 });
  }
}
