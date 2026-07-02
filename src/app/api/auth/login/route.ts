import { NextResponse } from "next/server";
import { authenticate, createSession, ensureFounder } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const identifier = String(body.email || body.employeeId || "").trim();
  const password = body.password;
  if (!identifier || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  // First-run: create the founder admin if no users exist yet.
  await ensureFounder();

  const user = await authenticate(identifier, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  await createSession(user);
  return NextResponse.json({ user });
}
