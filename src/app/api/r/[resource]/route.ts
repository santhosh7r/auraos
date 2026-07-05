import { NextResponse } from "next/server";
import type { Model } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { serializeList, serializeDoc } from "@/lib/serialize";
import {
  ClientModel, ProjectModel, TaskModel, LeadModel,
  InvoiceModel, ExpenseModel, NotificationModel, ContentPlanModel,
} from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESOURCES: Record<string, { model: Model<unknown>; financeOnly?: boolean }> = {
  clients: { model: ClientModel as Model<unknown> },
  projects: { model: ProjectModel as Model<unknown> },
  tasks: { model: TaskModel as Model<unknown> },
  leads: { model: LeadModel as Model<unknown> },
  invoices: { model: InvoiceModel as Model<unknown>, financeOnly: true },
  expenses: { model: ExpenseModel as Model<unknown>, financeOnly: true },
  notifications: { model: NotificationModel as Model<unknown> },
  content: { model: ContentPlanModel as Model<unknown> },
};

function canFinance(role?: string) {
  return role === "admin" || role === "finance";
}

/* Real notifications — emitted when an entity is actually created. */
const NOTIFY: Record<string, (d: Record<string, unknown>) => { type: string; title: string; body: string; href: string }> = {
  leads: (d) => ({ type: "lead", title: "New lead added", body: `${d.company || d.name} entered the pipeline.`, href: "/leads" }),
  clients: (d) => ({ type: "client", title: "New client added", body: `${d.name} is now an active account.`, href: "/clients" }),
  projects: (d) => ({ type: "project", title: "New project created", body: `${d.name} kicked off.`, href: "/projects" }),
  tasks: (d) => ({ type: "task", title: "New task created", body: String(d.title ?? ""), href: "/tasks" }),
  invoices: (d) => ({ type: "invoice", title: "New invoice created", body: `Invoice ${d.number ?? ""}`, href: "/invoices" }),
  content: (d) => ({ type: "system", title: "New content planned", body: String(d.title ?? ""), href: "/content" }),
};

async function notifyCreated(resource: string, doc: Record<string, unknown>) {
  const build = NOTIFY[resource];
  if (!build) return;
  try {
    await NotificationModel.create({ ...build(doc), userId: "all", read: false });
  } catch {
    /* notifications are best-effort */
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  const entry = RESOURCES[resource];
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (entry.financeOnly && !canFinance(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const filter = resource === "notifications" ? { userId: { $in: [session.id, "all"] } } : {};
  const docs = await entry.model.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ data: serializeList(docs as Record<string, unknown>[]) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  const entry = RESOURCES[resource];
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (entry.financeOnly && !canFinance(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  delete body.id;
  delete body._id;

  // Stamp the creator on models that track ownership (e.g. leads), so amount
  // visibility can be gated to "admin, or the person who added it".
  if (entry.model.schema.path("createdBy") && !body.createdBy) {
    body.createdBy = session.id;
  }

  await connectToDatabase();
  const created = await entry.model.create(body);
  const obj = created.toObject() as Record<string, unknown>;
  await notifyCreated(resource, obj);
  return NextResponse.json({ data: serializeDoc(obj) }, { status: 201 });
}
