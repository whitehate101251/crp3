import type { UserRole } from "@/lib/types";
import { verifySession, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RequestSessionUser = {
  id: string;
  role: UserRole;
  site_id: string | null;
};

function getCookieValue(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

export async function getRequestSessionUser(request: Request): Promise<RequestSessionUser | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = getCookieValue(cookieHeader, AUTH_COOKIE_NAME);

  if (!token) {
    return null;
  }

  try {
    const session = await verifySession(token);
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, role, site_id")
      .eq("id", session.sub)
      .maybeSingle();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      site_id: user.site_id,
    } as RequestSessionUser;
  } catch {
    return null;
  }
}