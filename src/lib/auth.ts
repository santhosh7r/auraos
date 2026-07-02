import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models";
import type { Role, SessionUser, TeamMember } from "@/lib/types";

const COOKIE = "aura_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "aura-os-dev-secret-change-me-in-production"
);

/* ---- password ---- */
export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/* ---- jwt ---- */
async function sign(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
}

/* ---- session cookie ---- */
export async function createSession(user: SessionUser) {
  const token = await sign(user);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      title: String(payload.title ?? ""),
      avatar: payload.avatar ? String(payload.avatar) : undefined,
    };
  } catch {
    return null;
  }
}

/* ---- credential auth (by employee ID or email) ---- */
export async function authenticate(
  identifier: string,
  password: string
): Promise<SessionUser | null> {
  await connectToDatabase();
  const id = identifier.trim();
  const user = await UserModel.findOne({
    $or: [{ employeeId: id }, { email: id.toLowerCase() }],
  })
    .select("+passwordHash")
    .lean();
  if (!user) return null;
  if (user.status === "inactive") return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    title: user.title,
    avatar: user.avatar,
  };
}

/* ---- founder bootstrap (idempotent, single admin) ---- */
export async function ensureFounder() {
  await connectToDatabase();
  const count = await UserModel.estimatedDocumentCount();
  if (count > 0) return;
  const email = process.env.FOUNDER_EMAIL || "ceo@auradigitalservices.in";
  const password = process.env.FOUNDER_PASSWORD || "123";
  await UserModel.create({
    name: "Aura Admin",
    email,
    employeeId: process.env.FOUNDER_EMPLOYEE_ID || "EMP001",
    passwordHash: await hashPassword(password),
    role: "admin",
    title: "Founder",
    department: "Leadership",
    location: "",
    status: "active",
    joiningDate: new Date().toISOString().slice(0, 10),
  });
}

/* ---- helpers for server components / actions ---- */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export function isAdmin(role: Role) {
  return role === "admin";
}

export function toTeamMember(doc: UserLean): TeamMember {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    employeeId: doc.employeeId ?? "",
    role: doc.role as Role,
    title: doc.title,
    department: doc.department as TeamMember["department"],
    phone: doc.phone ?? "",
    location: doc.location ?? "",
    avatar: doc.avatar,
    status: (doc.status as TeamMember["status"]) ?? "active",
    joiningDate: doc.joiningDate ?? "",
    lastActiveAt: doc.lastActiveAt ? new Date(doc.lastActiveAt).toISOString() : "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
  };
}

export interface UserLean {
  _id: unknown;
  name: string;
  email: string;
  employeeId?: string;
  role: string;
  title: string;
  department: string;
  phone?: string;
  location?: string;
  avatar?: string;
  status?: string;
  joiningDate?: string;
  lastActiveAt?: Date | string;
  createdAt?: Date | string;
}
