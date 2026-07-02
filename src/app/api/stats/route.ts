import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import {
  ClientModel, ProjectModel, TaskModel, LeadModel, InvoiceModel, ExpenseModel, UserModel,
} from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function groupCount<T extends { status?: string }>(rows: T[], key: keyof T = "status" as keyof T) {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key] ?? "");
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canFinance = session.role === "admin" || session.role === "finance";

  await connectToDatabase();
  const [clients, projects, tasks, leads, team, invoices, expenses] = await Promise.all([
    ClientModel.find({}).lean(),
    ProjectModel.find({}).lean(),
    TaskModel.find({}).lean(),
    LeadModel.find({}).lean(),
    UserModel.countDocuments({}),
    InvoiceModel.find({}).lean(),
    ExpenseModel.find({}).lean(),
  ]);

  const c = clients as { status?: string; health?: string }[];
  const p = projects as { status?: string; progress?: number }[];
  const t = tasks as { status?: string }[];
  const l = leads as { status?: string; value?: number }[];
  const inv = invoices as { status?: string; amount?: number }[];
  const exp = expenses as { amount?: number }[];

  const wonValue = l.filter((x) => x.status === "won").reduce((s, x) => s + (x.value || 0), 0);
  const openPipeline = l
    .filter((x) => !["won", "lost"].includes(x.status || ""))
    .reduce((s, x) => s + (x.value || 0), 0);

  const stats: Record<string, unknown> = {
    counts: {
      clients: c.length,
      activeClients: c.filter((x) => x.status === "active").length,
      projects: p.length,
      activeProjects: p.filter((x) => x.status === "in_progress").length,
      tasks: t.length,
      openTasks: t.filter((x) => x.status !== "done").length,
      leads: l.length,
      team,
    },
    projectsByStatus: groupCount(p),
    tasksByStatus: groupCount(t),
    leadsByStatus: groupCount(l),
    clientHealth: groupCount(c, "health"),
    avgProgress: p.length ? Math.round(p.reduce((s, x) => s + (x.progress || 0), 0) / p.length) : 0,
    openPipeline,
    wonValue,
  };

  if (canFinance) {
    const paid = inv.filter((x) => x.status === "paid").reduce((s, x) => s + (x.amount || 0), 0);
    const outstanding = inv
      .filter((x) => x.status === "sent" || x.status === "overdue")
      .reduce((s, x) => s + (x.amount || 0), 0);
    const totalExpenses = exp.reduce((s, x) => s + (x.amount || 0), 0);
    stats.finance = {
      revenue: paid,
      outstanding,
      expenses: totalExpenses,
      profit: paid - totalExpenses,
      invoicesByStatus: groupCount(inv),
    };
  }

  return NextResponse.json({ data: stats });
}
