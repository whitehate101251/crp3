import { NextResponse } from "next/server";
import { getRequestSessionUser } from "@/lib/auth/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(request);
  if (!user || !["ADMIN", "SITE_INCHARGE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const roleParam = new URL(request.url).searchParams.get("role");
  const role: UserRole | null = roleParam && ["ADMIN", "SITE_INCHARGE", "FOREMAN"].includes(roleParam)
    ? (roleParam as UserRole)
    : null;

  let query = supabaseAdmin
    .from("users")
    .select("id, auth_id, username, name, father_name, role, phone, site_id, parent_id, created_at")
    .order("created_at", { ascending: false });

  if (role) {
    query = query.eq("role", role);
  }

  if (user.role === "SITE_INCHARGE") {
    if (user.site_id) {
      query = query.eq("site_id", user.site_id);
    } else {
      query = query.eq("id", user.id);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
