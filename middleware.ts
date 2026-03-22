import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/auth/session";

const publicPaths = ["/login"];
const authApiPaths = ["/api/auth/login", "/api/auth/logout", "/api/auth/session"];

function getRoleHomePath(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "SITE_INCHARGE") return "/site-incharge";
  return "/foreman";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authApiPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (publicPaths.includes(pathname)) {
    if (token) {
      try {
        const session = await verifySession(token);
        return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
      } catch {
        const response = NextResponse.next();
        response.cookies.set(AUTH_COOKIE_NAME, "", {
          path: "/",
          maxAge: 0,
        });
        return response;
      }
    }

    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let role: string;

  try {
    const session = await verifySession(token);
    role = session.role;
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL(getRoleHomePath(role), request.url));
  }

  if (pathname.startsWith("/site-incharge") && role !== "SITE_INCHARGE") {
    return NextResponse.redirect(new URL(getRoleHomePath(role), request.url));
  }

  if (pathname.startsWith("/foreman") && role !== "FOREMAN") {
    return NextResponse.redirect(new URL(getRoleHomePath(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
