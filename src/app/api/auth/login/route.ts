import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { AUTH_COOKIE_NAME, signSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoleRedirectPath } from "@/lib/utils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, username, name, role, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? "");
    if (error.code === "42501") {
      return NextResponse.json({ error: "Database permissions are not configured for login." }, { status: 500 });
    }

    if (message.includes("fetch failed") || message.includes("Connect Timeout")) {
      return NextResponse.json({ error: "Database connection failed. Please try again." }, { status: 503 });
    }

    return NextResponse.json({ error: "Login service unavailable." }, { status: 500 });
  }

  if (!user?.password_hash) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const isValidPassword = await compare(password, user.password_hash);

  if (!isValidPassword) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const redirectUrl = getRoleRedirectPath(user.role);
  const sessionToken = await signSession({
    sub: user.id,
    role: user.role,
    username: user.username,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
    redirectTo: redirectUrl,
  });

  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
