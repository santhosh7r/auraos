import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "aura-os-dev-secret-change-me-in-production"
);

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/_next", "/favicon"];

async function hasValidSession(req: NextRequest) {
  const token = req.cookies.get("aura_session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(req);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(authed ? "/dashboard" : "/login", req.url));
  }

  if (!authed) {
    const url = new URL("/login", req.url);
    if (pathname !== "/login") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
