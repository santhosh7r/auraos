import { NextResponse } from "next/server";
import type { Model } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { serializeDoc } from "@/lib/serialize";
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

/* Real notifications — emitted when a record reaches a meaningful status. */
type Notif = { type: string; title: string; body: string; href: string };
const NOTIFY_STATUS: Record<string, Record<string, (d: Record<string, unknown>) => Notif>> = {
  leads: {
    won: (d) => ({ type: "lead", title: "Lead won 🎉", body: `${d.company || d.name} is now won.`, href: "/leads" }),
    lost: (d) => ({ type: "lead", title: "Lead lost", body: `${d.company || d.name} was marked lost.`, href: "/leads" }),
  },
  tasks: {
    done: (d) => ({ type: "task", title: "Task completed", body: String(d.title ?? ""), href: "/tasks" }),
  },
  projects: {
    completed: (d) => ({ type: "project", title: "Project completed", body: `${d.name} wrapped up.`, href: "/projects" }),
    on_hold: (d) => ({ type: "project", title: "Project on hold", body: `${d.name} was put on hold.`, href: "/projects" }),
  },
  invoices: {
    paid: (d) => ({ type: "invoice", title: "Invoice paid", body: `Invoice ${d.number ?? ""} was paid.`, href: "/invoices" }),
    overdue: (d) => ({ type: "invoice", title: "Invoice overdue", body: `Invoice ${d.number ?? ""} is overdue.`, href: "/invoices" }),
  },
};

async function notifyStatusChange(
  resource: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
) {
  const byStatus = NOTIFY_STATUS[resource];
  if (!byStatus) return;
  const status = String(after.status ?? "");
  // Only fire when the status actually transitions into a milestone value.
  if (!status || before?.status === after.status) return;
  const build = byStatus[status];
  if (!build) return;
  try {
    await NotificationModel.create({ ...build(after), userId: "all", read: false });
  } catch {
    /* notifications are best-effort */
  }
}

async function guard(resource: string) {
  const entry = RESOURCES[resource];
  if (!entry) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (entry.financeOnly && !canFinance(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { entry, session };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  await connectToDatabase();
  const doc = await g.entry.model.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: serializeDoc(doc as Record<string, unknown>) });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  delete body.id;
  delete body._id;
  await connectToDatabase();
  const before = (await g.entry.model.findById(id).lean()) as Record<string, unknown> | null;
  const doc = await g.entry.model
    .findByIdAndUpdate(id, body, { new: true })
    .lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await notifyStatusChange(resource, before, doc as Record<string, unknown>);
  return NextResponse.json({ data: serializeDoc(doc as Record<string, unknown>) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  await connectToDatabase();
  await g.entry.model.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
