import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, hashPassword } from "@/lib/auth";
import {
  UserModel, ClientModel, ProjectModel, TaskModel, LeadModel,
  InvoiceModel, ExpenseModel, NotificationModel, ContentPlanModel,
} from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 * Aura HQ — demo seed
 * POST /api/seed  (admin session, or ?secret=SEED_SECRET)
 * Wipes the workspace and rebuilds a realistic, alive dataset so the
 * founder command center has something to show. Idempotent.
 * ------------------------------------------------------------------ */

const DAY = 86400_000;
function iso(offsetDays: number) {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}
function at(offsetDays: number, hour = 10) {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const session = await getSession();
  const allowed =
    (process.env.SEED_SECRET && secret === process.env.SEED_SECRET) ||
    session?.role === "admin";
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  /* ---- team (keep founder, rebuild the rest) ---- */
  const founder = await UserModel.findOne({ role: "admin" }).sort({ createdAt: 1 }).lean();
  await UserModel.deleteMany({ _id: { $ne: founder?._id } });
  await Promise.all([
    ClientModel.deleteMany({}), ProjectModel.deleteMany({}), TaskModel.deleteMany({}),
    LeadModel.deleteMany({}), InvoiceModel.deleteMany({}), ExpenseModel.deleteMany({}),
    NotificationModel.deleteMany({}), ContentPlanModel.deleteMany({}),
  ]);

  const pw = await hashPassword("aura@123");
  const people = [
    { name: "Aanya Sharma", email: "aanya@auradigitalservices.in", role: "manager", title: "Head of Delivery", department: "Operations", location: "Bengaluru" },
    { name: "Dev Patel", email: "dev@auradigitalservices.in", role: "developer", title: "Lead Engineer", department: "Engineering", location: "Pune" },
    { name: "Maya Rao", email: "maya@auradigitalservices.in", role: "designer", title: "Principal Designer", department: "Design", location: "Remote" },
    { name: "Karan Mehta", email: "karan@auradigitalservices.in", role: "sales", title: "Account Executive", department: "Sales", location: "Mumbai" },
    { name: "Riya Nair", email: "riya@auradigitalservices.in", role: "marketing", title: "Growth Lead", department: "Marketing", location: "Remote" },
    { name: "Arjun Iyer", email: "arjun@auradigitalservices.in", role: "finance", title: "Finance Manager", department: "Finance", location: "Bengaluru" },
    { name: "Sara Khan", email: "sara@auradigitalservices.in", role: "developer", title: "Frontend Engineer", department: "Engineering", location: "Remote" },
  ];
  const created = await UserModel.insertMany(
    people.map((p, i) => ({
      ...p, passwordHash: pw, status: "active",
      joiningDate: iso(-420 + i * 40), phone: "+91 90000 0000" + i,
    }))
  );
  const ids = Object.fromEntries(created.map((u) => [u.email.split("@")[0], String(u._id)]));
  const founderId = String(founder?._id ?? created[0]._id);
  const team = {
    founder: founderId, aanya: ids.aanya, dev: ids.dev, maya: ids.maya,
    karan: ids.karan, riya: ids.riya, arjun: ids.arjun, sara: ids.sara,
  };
  const everyone = [founderId, ...created.map((u) => String(u._id))];

  /* ---- clients ---- */
  const clientSeed = [
    { name: "Lumen Health", industry: "Healthtech", health: "green", status: "active", am: team.aanya },
    { name: "Northwind Capital", industry: "Fintech", health: "green", status: "active", am: team.karan },
    { name: "Orbit Mobility", industry: "Logistics", health: "yellow", status: "active", am: team.aanya },
    { name: "Vellum Studios", industry: "Media", health: "green", status: "active", am: team.maya },
    { name: "Cobalt Retail", industry: "E-commerce", health: "red", status: "active", am: team.karan },
    { name: "Brightwave Energy", industry: "Cleantech", health: "green", status: "active", am: team.aanya },
    { name: "Atlas Logistics", industry: "Supply Chain", health: "yellow", status: "active", am: team.karan },
    { name: "Pine & Co", industry: "Hospitality", health: "green", status: "prospect", am: team.karan },
  ];
  const clients = await ClientModel.insertMany(
    clientSeed.map((c, i) => ({
      name: c.name, industry: c.industry, status: c.status, health: c.health,
      accountManager: c.am, email: `hello@${c.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      phone: "+1 415 555 01" + (10 + i), website: `${c.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      address: "San Francisco, CA", notes: "",
    }))
  );
  const cid = (n: string) => String(clients.find((c) => c.name === n)!._id);

  /* ---- projects ---- */
  const projectSeed = [
    { name: "Patient Portal Redesign", client: "Lumen Health", status: "in_progress", priority: "high", budget: 145000, progress: 68, lead: team.maya, team: [team.maya, team.dev, team.sara], due: 22 },
    { name: "Wealth Dashboard v2", client: "Northwind Capital", status: "in_progress", priority: "urgent", budget: 220000, progress: 41, lead: team.dev, team: [team.dev, team.sara, team.maya], due: 9 },
    { name: "Fleet Tracking Platform", client: "Orbit Mobility", status: "review", priority: "high", budget: 178000, progress: 88, lead: team.dev, team: [team.dev, team.aanya], due: 4 },
    { name: "Brand & Marketing Site", client: "Vellum Studios", status: "in_progress", priority: "medium", budget: 64000, progress: 55, lead: team.maya, team: [team.maya, team.riya], due: 16 },
    { name: "Checkout Optimization", client: "Cobalt Retail", status: "on_hold", priority: "high", budget: 98000, progress: 30, lead: team.dev, team: [team.dev, team.sara], due: -3 },
    { name: "Grid Analytics Suite", client: "Brightwave Energy", status: "planning", priority: "medium", budget: 132000, progress: 12, lead: team.aanya, team: [team.aanya, team.dev], due: 48 },
    { name: "Driver Mobile App", client: "Atlas Logistics", status: "in_progress", priority: "high", budget: 156000, progress: 62, lead: team.sara, team: [team.sara, team.dev, team.maya], due: 19 },
    { name: "Loyalty Program Launch", client: "Cobalt Retail", status: "completed", priority: "medium", budget: 72000, progress: 100, lead: team.riya, team: [team.riya, team.maya], due: -12 },
    { name: "Investor Reporting Tools", client: "Northwind Capital", status: "completed", priority: "low", budget: 54000, progress: 100, lead: team.dev, team: [team.dev], due: -28 },
    { name: "Care Team Mobile", client: "Lumen Health", status: "planning", priority: "medium", budget: 110000, progress: 8, lead: team.maya, team: [team.maya, team.sara], due: 60 },
  ];
  const projects = await ProjectModel.insertMany(
    projectSeed.map((p) => ({
      name: p.name, clientId: cid(p.client), status: p.status, priority: p.priority,
      budget: p.budget, progress: p.progress, lead: p.lead, team: p.team,
      startDate: iso(-90), deadline: iso(p.due),
      description: `${p.name} for ${p.client}.`,
    }))
  );
  const pid = (n: string) => String(projects.find((p) => p.name === n)!._id);

  /* ---- tasks (several assigned to the founder for "today's focus") ---- */
  const taskSeed = [
    { title: "Approve Q3 delivery roadmap", project: "Wealth Dashboard v2", status: "todo", priority: "urgent", assignee: team.founder, due: 0 },
    { title: "Review Northwind contract renewal", project: "Wealth Dashboard v2", status: "todo", priority: "high", assignee: team.founder, due: 1 },
    { title: "Sign off on Fleet platform launch", project: "Fleet Tracking Platform", status: "review", priority: "urgent", assignee: team.founder, due: 0 },
    { title: "1:1 with Maya — design hiring", project: "Patient Portal Redesign", status: "todo", priority: "medium", assignee: team.founder, due: 2 },
    { title: "Finalize accessibility audit", project: "Patient Portal Redesign", status: "in_progress", priority: "high", assignee: team.maya, due: 3 },
    { title: "Integrate payments SDK", project: "Wealth Dashboard v2", status: "in_progress", priority: "urgent", assignee: team.dev, due: 2 },
    { title: "Load test fleet ingestion", project: "Fleet Tracking Platform", status: "review", priority: "high", assignee: team.dev, due: 1 },
    { title: "Driver onboarding screens", project: "Driver Mobile App", status: "in_progress", priority: "high", assignee: team.sara, due: 5 },
    { title: "Cobalt checkout copy", project: "Checkout Optimization", status: "todo", priority: "medium", assignee: team.riya, due: 7 },
    { title: "Grid analytics data model", project: "Grid Analytics Suite", status: "todo", priority: "medium", assignee: team.dev, due: 10 },
    { title: "Investor report export bug", project: "Investor Reporting Tools", status: "done", priority: "low", assignee: team.dev, due: -2 },
    { title: "Loyalty launch retro", project: "Loyalty Program Launch", status: "done", priority: "low", assignee: team.riya, due: -5 },
    { title: "Care team push notifications", project: "Care Team Mobile", status: "todo", priority: "medium", assignee: team.maya, due: 14 },
    { title: "Brand site CMS migration", project: "Brand & Marketing Site", status: "in_progress", priority: "medium", assignee: team.maya, due: 6 },
    { title: "QA fleet geofencing", project: "Fleet Tracking Platform", status: "review", priority: "high", assignee: team.sara, due: 1 },
  ];
  await TaskModel.insertMany(
    taskSeed.map((t) => ({
      title: t.title, projectId: pid(t.project), status: t.status, priority: t.priority,
      assignee: t.assignee, dueDate: iso(t.due), description: "",
    }))
  );

  /* ---- leads (pipeline) ---- */
  const leadSeed = [
    { name: "Priya Desai", company: "Helio Robotics", source: "Referral", status: "proposal", value: 185000, owner: team.karan },
    { name: "Tom Becker", company: "Quanta Labs", source: "LinkedIn", status: "qualified", value: 120000, owner: team.karan },
    { name: "Lena Fischer", company: "Mosaic Travel", source: "Website", status: "contacted", value: 78000, owner: team.riya },
    { name: "Raj Malhotra", company: "Finch Payments", source: "Event", status: "new", value: 240000, owner: team.karan },
    { name: "Chloe Adams", company: "Verde Foods", source: "Website", status: "qualified", value: 92000, owner: team.karan },
    { name: "Sam Oduya", company: "Kite Insurance", source: "Cold Outreach", status: "proposal", value: 156000, owner: team.karan },
    { name: "Hana Suzuki", company: "Pixel Forge", source: "Referral", status: "won", value: 134000, owner: team.karan },
    { name: "Miguel Santos", company: "Cedar Health", source: "LinkedIn", status: "contacted", value: 67000, owner: team.riya },
    { name: "Olivia Grant", company: "Tilt Studios", source: "Event", status: "new", value: 45000, owner: team.riya },
    { name: "Noah Klein", company: "Strand Media", source: "Referral", status: "lost", value: 88000, owner: team.karan },
  ];
  await LeadModel.insertMany(
    leadSeed.map((l, i) => ({
      name: l.name, company: l.company, source: l.source, status: l.status, value: l.value,
      assignedTo: l.owner, email: `${l.name.split(" ")[0].toLowerCase()}@${l.company.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      phone: "+1 628 555 02" + (10 + i), notes: "",
    }))
  );

  /* ---- invoices ---- */
  const invoiceSeed = [
    { client: "Lumen Health", project: "Patient Portal Redesign", amount: 48000, status: "paid", issue: -40, due: -10 },
    { client: "Northwind Capital", project: "Wealth Dashboard v2", amount: 75000, status: "paid", issue: -35, due: -5 },
    { client: "Orbit Mobility", project: "Fleet Tracking Platform", amount: 60000, status: "sent", issue: -12, due: 18 },
    { client: "Vellum Studios", project: "Brand & Marketing Site", amount: 22000, status: "sent", issue: -8, due: 22 },
    { client: "Cobalt Retail", project: "Checkout Optimization", amount: 33000, status: "overdue", issue: -50, due: -20 },
    { client: "Atlas Logistics", project: "Driver Mobile App", amount: 52000, status: "sent", issue: -6, due: 24 },
    { client: "Brightwave Energy", project: "Grid Analytics Suite", amount: 40000, status: "draft", issue: -2, due: 28 },
    { client: "Cobalt Retail", project: "Loyalty Program Launch", amount: 36000, status: "paid", issue: -60, due: -30 },
    { client: "Northwind Capital", project: "Investor Reporting Tools", amount: 27000, status: "paid", issue: -70, due: -40 },
    { client: "Lumen Health", project: "Care Team Mobile", amount: 18000, status: "draft", issue: -1, due: 30 },
  ];
  await InvoiceModel.insertMany(
    invoiceSeed.map((v, i) => ({
      number: `AU-2026-${String(101 + i).padStart(4, "0")}`,
      clientId: cid(v.client), projectId: pid(v.project), amount: v.amount,
      status: v.status, issueDate: iso(v.issue), dueDate: iso(v.due),
    }))
  );

  /* ---- expenses ---- */
  const expenseSeed = [
    { category: "Salaries", vendor: "Payroll", amount: 184000, day: -25 },
    { category: "Software", vendor: "Vercel + Figma + Linear", amount: 4200, day: -20 },
    { category: "Marketing", vendor: "Meta Ads", amount: 12500, day: -18 },
    { category: "Contractors", vendor: "Studio Nine", amount: 22000, day: -15 },
    { category: "Office", vendor: "WeWork", amount: 9800, day: -12 },
    { category: "Software", vendor: "AWS", amount: 7600, day: -8 },
    { category: "Marketing", vendor: "Conference Sponsorship", amount: 15000, day: -5 },
    { category: "Other", vendor: "Legal", amount: 6400, day: -3 },
  ];
  await ExpenseModel.insertMany(
    expenseSeed.map((e) => ({
      category: e.category, vendor: e.vendor, amount: e.amount, date: iso(e.day), notes: "",
    }))
  );

  /* ---- content plans (monthly / weekly / daily across types) ---- */
  const contentSeed = [
    { title: "Q3 content calendar overview", type: "campaign", scope: "monthly", status: "planned", owner: team.riya, day: 1 },
    { title: "Brand refresh announcement", type: "blog", scope: "monthly", status: "idea", owner: team.maya, day: 6 },
    { title: "Weekly product newsletter", type: "newsletter", scope: "weekly", status: "planned", owner: team.riya, day: 2 },
    { title: "Customer story: Lumen Health", type: "blog", scope: "weekly", status: "in_progress", owner: team.riya, day: 4 },
    { title: "Design tips reel", type: "video", scope: "weekly", status: "planned", owner: team.maya, day: 5 },
    { title: "Instagram carousel — fleet launch", type: "social", scope: "daily", status: "planned", owner: team.maya, day: 0 },
    { title: "LinkedIn post — hiring", type: "social", scope: "daily", status: "published", owner: team.karan, day: -1 },
    { title: "Daily standup recap thread", type: "social", scope: "daily", status: "planned", owner: team.riya, day: 3 },
    { title: "Wealth Dashboard launch ad", type: "campaign", scope: "weekly", status: "in_progress", owner: team.karan, day: 8 },
    { title: "Tutorial video — onboarding", type: "video", scope: "monthly", status: "idea", owner: team.maya, day: 14 },
  ];
  await ContentPlanModel.insertMany(
    contentSeed.map((c) => ({
      title: c.title, type: c.type, scope: c.scope, status: c.status,
      assignee: c.owner, date: iso(c.day), description: "",
    }))
  );

  // Notifications are NOT seeded — they're generated by real actions (creating
  // leads/clients/projects/tasks/invoices) so the bell only shows real events.

  return NextResponse.json({
    ok: true,
    counts: {
      team: everyone.length, clients: clients.length, projects: projects.length,
      tasks: taskSeed.length, leads: leadSeed.length, invoices: invoiceSeed.length,
      expenses: expenseSeed.length, content: contentSeed.length,
    },
  });
}
