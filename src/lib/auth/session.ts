import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/types";

export const AUTH_COOKIE_NAME = "construction-erp-session";

export type SessionPayload = {
  sub: string;
  role: UserRole;
  username: string;
};

function getSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET missing");
  }

  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, getSecret());

  return {
    sub: String(payload.sub ?? ""),
    role: String(payload.role ?? "") as UserRole,
    username: String(payload.username ?? ""),
  } as SessionPayload;
}
