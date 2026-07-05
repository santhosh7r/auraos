"use client";

import * as React from "react";
import Link from "next/link";
import { useResource } from "@/lib/use-resource";
import { useConfig } from "@/lib/use-config";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectStatusBadge, PriorityBadge } from "@/components/shared/badges";
import { AvatarStack } from "@/components/shared/avatar-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PROJECT_STAGES, PRIORITIES, LEAD_SERVICES, type Project, type ProjectStatus, type Priority, type Client, type Task,
} from "@/lib/types";
import { cn, formatCurrency, formatDate, toBaseUSD, fromBaseUSD, CURRENCY_META } from "@/lib/utils";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  Plus, Search, FolderKanban, Gauge, DollarSign, PauseCircle, MoreHorizontal,
  Pencil, Trash2, Loader2, CalendarDays,
} from "lucide-react";

type FormState = {
  name: string; clientId: string; service: string; status: ProjectStatus; priority: Priority;
  budget: string; startDate: string; deadline: string;
  lead: string; team: string[]; description: string;
};

const EMPTY: FormState = {
  name: "", clientId: "", service: "", status: "planning", priority: "medium",
  budget: "", startDate: "", deadline: "",
  lead: "", team: [], description: "",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

export default function ProjectsPage() {
  const { caps } = useSession();
  const { members } = useTeam();
  const { currency } = useCurrency();
  const config = useConfig();
  const serviceOptions = config.leadServices ?? LEAD_SERVICES;
  const { data, loading, create, update, remove } = useResource<Project>("/api/r/projects");
  const clients = useResource<Client>("/api/r/clients");
  const tasks = useResource<Task>("/api/r/tasks");

  // Project progress is derived from its tasks (done ÷ total), never entered by
  // hand. A completed project is always 100%, regardless of its tasks.
  const progressOf = React.useCallback(
    (project: Project) => {
      if (project.status === "completed") return 100;
      const ts = tasks.data.filter((t) => t.projectId === project.id);
      if (ts.length === 0) return 0;
      return Math.round((ts.filter((t) => t.status === "done").length / ts.length) * 100);
    },
    [tasks.data]
  );

  const clientName = React.useCallback(
    (id: string) => clients.data.find((c) => c.id === id)?.name ?? "—",
    [clients.data]
  );

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Project | null>(null);

  // Drag a project card to another column to change its stage.
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);

  function moveProject(id: string, status: ProjectStatus) {
    const p = data.find((x) => x.id === id);
    if (p && p.status !== status) void update(id, { status });
  }

  const filtered = data.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || clientName(p.clientId).toLowerCase().includes(q);
    const matchS = statusFilter === "all" || p.status === statusFilter;
    return matchQ && matchS;
  });

  const running = data.filter((p) => p.status === "in_progress").length;
  const onHold = data.filter((p) => p.status === "on_hold").length;
  const avgProgress = data.length
    ? Math.round(data.reduce((s, p) => s + progressOf(p), 0) / data.length)
    : 0;
  const totalBudget = data.reduce((s, p) => s + (p.budget || 0), 0);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, clientId: clients.data[0]?.id ?? "" });
    setDialogOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name, clientId: p.clientId, service: p.service ?? "", status: p.status, priority: p.priority,
      budget: p.budget ? String(Math.round(fromBaseUSD(p.budget))) : "", startDate: p.startDate?.slice(0, 10) ?? "",
      deadline: p.deadline?.slice(0, 10) ?? "",
      lead: p.lead ?? "", team: p.team ?? [], description: p.description ?? "",
    });
    setDialogOpen(true);
  }

  function toggleMember(id: string) {
    setForm((f) => ({
      ...f,
      team: f.team.includes(id) ? f.team.filter((m) => m !== id) : [...f.team, id],
    }));
  }

  // Open the edit dialog automatically when arriving from a project's detail
  // page via /projects?edit=<id>, then strip the param so it doesn't re-fire.
  const editHandled = React.useRef(false);
  React.useEffect(() => {
    if (editHandled.current || loading) return;
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    const p = data.find((x) => x.id === editId);
    if (p) {
      editHandled.current = true;
      // Opening the dialog from a one-time URL read is a valid effect action.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openEdit(p);
      window.history.replaceState(null, "", "/projects");
    }
  }, [loading, data]);

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      clientId: form.clientId,
      service: form.service,
      status: form.status,
      priority: form.priority,
      // Store the exact base value — rounding to whole USD drifts the amount
      // badly at high FX rates (e.g. ₹7000 → $84 → ₹6972).
      budget: toBaseUSD(Number(form.budget) || 0),
      startDate: form.startDate,
      deadline: form.deadline,
      lead: form.lead,
      team: form.team,
      description: form.description,
    };
    const res = editing ? await update(editing.id, payload) : await create(payload);
    setSaving(false);
    if (res) setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await remove(toDelete.id);
    setToDelete(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Track delivery across every engagement, stage, and timeline.">
        {caps.manageProjects && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="size-4" /> New project
          </Button>
        )}
      </PageHeader>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Running" value={String(running)} />
        <StatCard icon={Gauge} label="Avg progress" value={`${avgProgress}%`} />
        <StatCard icon={DollarSign} label="Total budget" value={formatCurrency(totalBudget, { compact: true })} />
        <StatCard icon={PauseCircle} label="On hold" value={String(onHold)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Spin up your first project to start tracking delivery, budgets and timelines."
          action={caps.manageProjects ? <Button onClick={openAdd}><Plus className="size-4" /> New project</Button> : undefined}
        />
      ) : (
        <Tabs defaultValue="board">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="h-9 w-full pl-9 sm:w-56"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {PROJECT_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Board */}
          <TabsContent value="board" className="mt-5">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {PROJECT_STAGES.map((stage) => {
                const col = filtered.filter((p) => p.status === stage.id);
                return (
                  <div key={stage.id} className="flex w-[300px] shrink-0 flex-col">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="size-2 rounded-full" style={{ background: stage.color }} />
                        {stage.label}
                      </span>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {col.length}
                      </span>
                    </div>
                    <div
                      onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== stage.id) setDragOverCol(stage.id); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                      onDrop={(e) => { e.preventDefault(); if (dragId) moveProject(dragId, stage.id); setDragId(null); setDragOverCol(null); }}
                      className={cn(
                        "mt-3 flex min-h-[120px] flex-1 flex-col gap-3 rounded-2xl border border-transparent p-0.5 transition-colors",
                        dragOverCol === stage.id && "border-brand/50 bg-brand/[0.06]"
                      )}
                    >
                      {col.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                          {dragOverCol === stage.id ? "Drop here" : "No projects"}
                        </p>
                      ) : (
                        col.map((p) => (
                          <div
                            key={p.id}
                            draggable={caps.manageProjects}
                            onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                            className={cn(
                              "group relative rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[hsl(0_0%_23%)]",
                              caps.manageProjects && "active:cursor-grabbing",
                              dragId === p.id && "opacity-50"
                            )}
                          >
                              <div className="absolute right-2 top-2">
                                {caps.manageProjects && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEdit(p)}><Pencil /> Edit</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setToDelete(p)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="!text-destructive" /> Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                              <Link href={`/projects/${p.id}`} draggable={false} className="block">
                                <div className="pr-6">
                                  <p className="truncate text-sm font-semibold leading-tight">{p.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{clientName(p.clientId)}</p>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <ProjectStatusBadge status={p.status} />
                                  <PriorityBadge priority={p.priority} />
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <Progress value={progressOf(p)} className="h-1.5 flex-1" indicatorClassName="bg-brand" />
                                  <span className="w-9 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                                    {progressOf(p)}%
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <CalendarDays className="size-3" />
                                    {p.deadline ? formatDate(p.deadline, { month: "short", day: "numeric" }) : "—"}
                                  </span>
                                  <AvatarStack mono ids={p.team ?? []} size="size-6" max={4} />
                                </div>
                                <p className="mt-2 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                  {formatCurrency(p.budget, { compact: true })}
                                </p>
                              </Link>
                            </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* List */}
          <TabsContent value="list" className="mt-5">
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title="No matches" description="Try a different search or status filter." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="w-[180px]">Progress</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link href={`/projects/${p.id}`} className="font-medium hover:text-brand">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{clientName(p.clientId)}</TableCell>
                        <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                        <TableCell><PriorityBadge priority={p.priority} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progressOf(p)} className="h-1.5 flex-1" indicatorClassName="bg-brand" />
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{progressOf(p)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.deadline ? formatDate(p.deadline) : "—"}</TableCell>
                        <TableCell><AvatarStack mono ids={p.team ?? []} size="size-6" /></TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(p.budget, { compact: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the project's scope, team and timeline." : "Create a project and assign a lead and team."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Project name" className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q3 social media campaign" />
            </Field>
            <Field label="Client" className="col-span-2">
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Service type" className="col-span-2">
              <Select value={form.service || "none"} onValueChange={(v) => setForm({ ...form, service: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unspecified</SelectItem>
                  {/* Keep the existing value selectable even if it was removed from config. */}
                  {form.service && !serviceOptions.includes(form.service) && (
                    <SelectItem value={form.service}>{form.service}</SelectItem>
                  )}
                  {serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Budget (${CURRENCY_META[currency].symbol})`}>
              <Input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="50000" />
            </Field>
            <Field label="Start date">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Deadline">
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
            <Field label="Lead" className="col-span-2">
              <Select value={form.lead} onValueChange={(v) => setForm({ ...form, lead: v })}>
                <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Team" className="col-span-2">
              <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
                {members.length === 0 ? (
                  <p className="col-span-2 px-1 py-2 text-xs text-muted-foreground">No members available.</p>
                ) : (
                  members.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
                      <Checkbox checked={form.team.includes(m.id)} onCheckedChange={() => toggleMember(m.id)} />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))
                )}
              </div>
            </Field>
            <Field label="Description" className="col-span-2">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this project about?" />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {toDelete?.name}?</DialogTitle>
            <DialogDescription>This permanently deletes the project. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(className)}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
