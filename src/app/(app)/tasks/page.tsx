"use client";

import * as React from "react";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge, TaskStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  TASK_STATUSES, PRIORITIES, type Task, type TaskStatus, type Priority,
  type Project, type Client,
} from "@/lib/types";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import {
  Plus, Search, LayoutGrid, List as ListIcon, MoreHorizontal,
  Pencil, Trash2, Loader2, ListTodo, CalendarDays,
  CircleDashed, CheckCircle2,
} from "lucide-react";

type View = "board" | "list";

type FormState = {
  title: string; description: string; status: TaskStatus; priority: Priority;
  assignee: string; projectId: string; dueDate: string;
};

const EMPTY: FormState = {
  title: "", description: "", status: "todo", priority: "medium",
  assignee: "", projectId: "", dueDate: "",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

function isPastDue(due: string) {
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(due).getTime() < today.getTime();
}

export default function TasksPage() {
  const { user } = useSession();
  const { members, byId } = useTeam();
  const { data, loading, create, update, remove } = useResource<Task>("/api/r/tasks");
  const projectsRes = useResource<Project>("/api/r/projects");
  const clientsRes = useResource<Client>("/api/r/clients");

  void clientsRes; // clients available if needed for future lookups

  const projectName = React.useCallback(
    (id: string) => projectsRes.data.find((p) => p.id === id)?.name ?? "—",
    [projectsRes.data]
  );

  const [view, setView] = React.useState<View>("board");
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Task | null>(null);

  // Drag-to-move between stages + tap-to-open detail popup.
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<Task | null>(null);

  function moveTask(id: string, status: TaskStatus) {
    const t = data.find((x) => x.id === id);
    if (t && t.status !== status) void update(id, { status });
  }

  const filtered = data.filter((t) => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || t.title.toLowerCase().includes(q);
    const matchP = projectFilter === "all" || t.projectId === projectFilter;
    const matchA =
      assigneeFilter === "all" ||
      (assigneeFilter === "me" ? t.assignee === user.id : t.assignee === assigneeFilter);
    const matchPr = priorityFilter === "all" || t.priority === priorityFilter;
    return matchQ && matchP && matchA && matchPr;
  });

  function openAdd(status: TaskStatus = "todo") {
    setEditing(null);
    setForm({
      ...EMPTY,
      status,
      assignee: user.id,
      projectId: projectsRes.data[0]?.id ?? "",
    });
    setDialogOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title, description: t.description ?? "", status: t.status,
      priority: t.priority, assignee: t.assignee ?? "", projectId: t.projectId ?? "",
      dueDate: t.dueDate?.slice(0, 10) ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title) return;
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assignee: form.assignee,
      projectId: form.projectId,
      dueDate: form.dueDate,
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
    <div>
      <PageHeader title="Tasks" description="Plan, track, and ship work across every project.">
        <Button onClick={() => openAdd()} className="gap-2">
          <Plus className="size-4" /> New task
        </Button>
      </PageHeader>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ListTodo} label="Total tasks" value={data.length} index={0} />
        <StatCard icon={CircleDashed} label="Open" value={data.filter((t) => t.status !== "done").length} index={1} />
        <StatCard icon={CheckCircle2} label="Completed" value={data.filter((t) => t.status === "done").length} index={2} />
        <StatCard icon={CalendarDays} label="Overdue" value={data.filter((t) => isPastDue(t.dueDate) && t.status !== "done").length} index={3} />
      </div>

      {/* Control bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center rounded-xl bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setView("board")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all",
              view === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-4" /> Board
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all",
              view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListIcon className="size-4" /> List
          </button>
        </div>

        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 pl-9"
          />
        </div>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-auto min-w-[150px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projectsRes.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-auto min-w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-72 shrink-0 space-y-2">
              <Skeleton className="h-7 w-full" />
              {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-24 rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Create your first task to start tracking work across your projects."
          action={<Button onClick={() => openAdd()}><Plus className="size-4" /> New task</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try adjusting your filters or search."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch(""); setProjectFilter("all"); setAssigneeFilter("all"); setPriorityFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === "board" ? (
        /* ---- Board · drag a card to another column to change its stage ---- */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const col = filtered.filter((t) => t.status === status.id);
            const isOver = dragOverCol === status.id;
            return (
              <div key={status.id} className="flex min-w-0 flex-col">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: status.color }} />
                    <span className="text-sm font-medium">{status.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{col.length}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground opacity-60 hover:opacity-100"
                    onClick={() => openAdd(status.id)}
                    aria-label={`Add task to ${status.label}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== status.id) setDragOverCol(status.id); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                  onDrop={(e) => { e.preventDefault(); if (dragId) moveTask(dragId, status.id); setDragId(null); setDragOverCol(null); }}
                  className={cn(
                    "flex min-h-[140px] flex-1 flex-col gap-2 rounded-2xl border border-transparent bg-muted/30 p-2 transition-colors",
                    isOver && "border-brand/50 bg-brand/[0.06]"
                  )}
                >
                  {col.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 py-8 text-xs text-muted-foreground">
                      {isOver ? "Drop here" : "No tasks"}
                    </div>
                  ) : (
                    col.map((t) => {
                      const m = byId(t.assignee);
                      const overdue = isPastDue(t.dueDate) && t.status !== "done";
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                          onClick={() => setViewing(t)}
                          className={cn(
                            "cursor-pointer rounded-2xl border border-border bg-card p-3 transition-colors hover:border-[hsl(0_0%_23%)] active:cursor-grabbing",
                            dragId === t.id && "opacity-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <PriorityBadge priority={t.priority} showLabel={false} />
                            {t.dueDate && (
                              <span className={cn(
                                "inline-flex items-center gap-1 text-[11px] tabular-nums",
                                overdue ? "font-medium text-destructive" : "text-muted-foreground"
                              )}>
                                <CalendarDays className="size-3" />
                                {relativeTime(t.dueDate)}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{t.title}</p>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-muted-foreground">{projectName(t.projectId)}</span>
                            {m && <UserAvatar name={m.name} src={m.avatar} className="size-6" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---- List ---- */
        <div className="space-y-4">
          {TASK_STATUSES.map((status) => {
            const items = filtered.filter((t) => t.status === status.id);
            if (items.length === 0) return null;
            return (
              <div key={status.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                  <TaskStatusBadge status={status.id} />
                  <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <ul className="divide-y divide-border/60">
                  {items.map((t) => {
                    const m = byId(t.assignee);
                    const overdue = isPastDue(t.dueDate) && t.status !== "done";
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                        <Checkbox
                          checked={t.status === "done"}
                          onCheckedChange={(c) => void update(t.id, { status: c ? "done" : "todo" })}
                          aria-label="Toggle done"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                        <span className="hidden w-40 shrink-0 truncate text-xs text-muted-foreground md:block">
                          {projectName(t.projectId)}
                        </span>
                        <span className="hidden w-20 shrink-0 sm:block">
                          <PriorityBadge priority={t.priority} />
                        </span>
                        {t.dueDate && (
                          <span className={cn(
                            "hidden w-24 shrink-0 text-right text-xs tabular-nums sm:block",
                            overdue ? "font-medium text-destructive" : "text-muted-foreground"
                          )}>
                            {formatDate(t.dueDate, { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {m && <UserAvatar name={m.name} src={m.avatar} className="size-6 shrink-0" />}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="shrink-0">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(t)}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setToDelete(t)} className="text-destructive focus:text-destructive">
                              <Trash2 className="!text-destructive" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail popup — opens on tap; edit or delete from here */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{viewing.title}</DialogTitle>
                <DialogDescription>{projectName(viewing.projectId)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stage</span>
                  <TaskStatusBadge status={viewing.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  <PriorityBadge priority={viewing.priority} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Assignee</span>
                  <span>{byId(viewing.assignee)?.name ?? "Unassigned"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Due</span>
                  <span className="tabular-nums">{viewing.dueDate ? formatDate(viewing.dueDate) : "—"}</span>
                </div>
                {viewing.description && (
                  <p className="rounded-lg bg-muted/40 p-3 leading-relaxed text-muted-foreground">{viewing.description}</p>
                )}
              </div>
              <DialogFooter className="sm:justify-between">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { const t = viewing; setViewing(null); setToDelete(t); }}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
                <Button onClick={() => { const t = viewing; setViewing(null); openEdit(t); }}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this task's details, status and assignment." : "Create a task and assign it to a project and teammate."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" className="col-span-2">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Schedule this week's social posts" />
            </Field>
            <Field label="Description" className="col-span-2">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to be done?" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
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
            <Field label="Assignee">
              <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project">
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projectsRes.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date" className="col-span-2">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove task?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{toDelete?.title}&rdquo;. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove task</Button>
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
