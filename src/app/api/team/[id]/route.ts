import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, hashPassword, isAdmin, toTeamMember, type UserLean } from "@/lib/auth";
import { UserModel } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only admins can edit team members." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const k of ["name", "email", "role", "title", "department", "phone", "location", "status"]) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (update.email) update.email = String(update.email).toLowerCase().trim();
  if (body.password) update.passwordHash = await hashPassword(String(body.password));

  await connectToDatabase();
  const doc = await UserModel.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: toTeamMember(doc as unknown as UserLean) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only admins can remove team members." }, { status: 403 });
  }
  if (id === session.id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }
  await connectToDatabase();
  await UserModel.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
