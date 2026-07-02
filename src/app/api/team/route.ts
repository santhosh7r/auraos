import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, hashPassword, isAdmin, toTeamMember, type UserLean } from "@/lib/auth";
import { UserModel } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const users = await UserModel.find({}).sort({ createdAt: 1 }).lean();
  return NextResponse.json({ data: (users as unknown as UserLean[]).map(toTeamMember) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only admins can add team members." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, password, role, title, department, phone, location, status } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }

  await connectToDatabase();
  const exists = await UserModel.findOne({ email: String(email).toLowerCase().trim() }).lean();
  if (exists) {
    return NextResponse.json({ error: "A member with this email already exists." }, { status: 409 });
  }

  const created = await UserModel.create({
    name,
    email: String(email).toLowerCase().trim(),
    passwordHash: await hashPassword(String(password)),
    role: role || "developer",
    title: title || "",
    department: department || "Operations",
    phone: phone || "",
    location: location || "",
    status: status || "active",
    joiningDate: new Date().toISOString().slice(0, 10),
  });

  return NextResponse.json(
    { data: toTeamMember(created.toObject() as unknown as UserLean) },
    { status: 201 }
  );
}
