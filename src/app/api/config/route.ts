import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, isAdmin } from "@/lib/auth";
import { SettingModel } from "@/models";
import { EXPENSE_CATEGORIES, DEPARTMENTS, LEAD_SERVICES, LEAD_SOURCES, INDUSTRIES, ROLES } from "@/lib/types";
import { NAV_KEYS, pagesForRole } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Customizable option lists. Anything here can be edited on the Config page. */
export const CONFIG_DEFAULTS: Record<string, string[]> = {
  leadServices: [...LEAD_SERVICES],
  leadSources: [...LEAD_SOURCES],
  expenseCategories: [...EXPENSE_CATEGORIES],
  departments: [...DEPARTMENTS],
  industries: [...INDUSTRIES],
  // Custom roles added on top of the built-in ROLES. Built-ins are not stored here.
  roles: [],
  // Display-name overrides for any role, encoded as "slug=Label" entries.
  roleLabels: [],
  // Built-in roles the admin has hidden/removed (admin can never be removed).
  removedRoles: [],
};

/** A per-role page-visibility override is stored under `pages:<role-slug>`. */
const PAGES_KEY_RE = /^pages:[a-z0-9-]+$/;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectToDatabase();
  const docs = (await SettingModel.find({}).lean()) as { key: string; values: string[] }[];
  const overrides = Object.fromEntries(docs.map((d) => [d.key, d.values]));

  const data: Record<string, string[]> = {};
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    data[key] = Array.isArray(overrides[key]) ? overrides[key] : CONFIG_DEFAULTS[key];
  }

  // Resolve every role (built-in + custom) and expose its page list so the
  // client can drive the sidebar and the page-access matrix.
  const customRoles = Array.isArray(data.roles) ? data.roles : [];
  const allRoles = [...ROLES, ...customRoles];
  for (const role of allRoles) {
    const key = `pages:${role}`;
    data[key] = pagesForRole(role, overrides[key]);
  }

  return NextResponse.json({ data });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only admins can change config." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { key, values } = body;

  const isPagesKey = typeof key === "string" && PAGES_KEY_RE.test(key);
  const isKnownKey = typeof key === "string" && key in CONFIG_DEFAULTS;
  if ((!isKnownKey && !isPagesKey) || !Array.isArray(values)) {
    return NextResponse.json({ error: "Invalid config." }, { status: 400 });
  }

  // Page overrides may only contain real nav keys; everything else is a trimmed string list.
  const clean = isPagesKey
    ? NAV_KEYS.filter((k) => values.includes(k))
    : [...new Set(values.map((v: unknown) => String(v).trim()).filter(Boolean))];

  await connectToDatabase();
  await SettingModel.findOneAndUpdate({ key }, { key, values: clean }, { upsert: true, new: true });
  return NextResponse.json({ data: { key, values: clean } });
}
