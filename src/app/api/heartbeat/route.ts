import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { UserModel } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Presence heartbeat — stamps the current user's lastActiveAt. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  await UserModel.findByIdAndUpdate(session.id, { lastActiveAt: new Date() }).catch(() => {});
  return NextResponse.json({ ok: true });
}
