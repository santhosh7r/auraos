"use client";

import * as React from "react";
import Link from "next/link";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { useAppConfig } from "@/components/providers/config-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
  DEPARTMENTS, CONTENT_TYPES, CONTENT_SCOPES,
  type TeamMember, type ContentPlan,
} from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

const ONLINE_WINDOW_MS = 3 * 60 * 1000; // "online" = active within 3 minutes
import {
  Plus, Search, Users, UserCheck, MoreHorizontal,
  Pencil, Trash2, Loader2, ShieldAlert, Ban, Unlock, CalendarRange, ArrowRight,
} from "lucide-react";

type FormState = {
  name: string; email: string; password: string; role: string;
  title: string; department: string; phone: string; location: string;
  status: TeamMember["status"];
};

const EMPTY: FormState = {
  name: "", email: "", password: "", role: "developer",
  title: "", department: "Engineering", phone: "", location: "", status: "active",
};

export default function TeamPage() {
  const { caps, user } = useSession();
  const team = useTeam();
  const appConfig = useAppConfig();
  const { data, loading, create, update, remove } = useResource<TeamMember>("/api/team");
  const content = useResource<ContentPlan>("/api/r/content");

  // Roles & departments resolved from config so custom values appear in dropdowns.
  const roleOptions = appConfig.roles;
  const departmentOptions = appConfig.config.departments?.length ? appConfig.config.departments : DEPARTMENTS;
  const roleLabel = appConfig.roleLabel;

  // Content plans grouped per assignee for the member panels.
  const contentByMember = React.useMemo(() => {
    const map = new Map<string, ContentPlan[]>();
    for (const c of content.data) {
      if (!c.assignee) continue;
      const arr = map.get(c.assignee);
      if (arr) arr.push(c);
      else map.set(c.assignee, [c]);
    }
    return map;
  }, [content.data]);

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TeamMember | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<TeamMember | null>(null);
  const [contentMember, setContentMember] = React.useState<TeamMember | null>(null);

  const filtered = data.filter((m) => {
    const q = search.toLowerCase();
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.title.toLowerCase().includes(q);
    const matchR = roleFilter === "all" || m.role === roleFilter;
    return matchQ && matchR;
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }
  function openEdit(m: TeamMember) {
    setEditing(m);
    setForm({
      name: m.name, email: m.email, password: "", role: m.role,
      title: m.title, department: m.department, phone: m.phone, location: m.location, status: m.status,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name || !form.email || (!editing && !form.password)) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (editing && !form.password) delete payload.password;
    const res = editing ? await update(editing.id, payload) : await create(payload);
    setSaving(false);
    if (res) {
      setDialogOpen(false);
      void team.refresh();
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const ok = await remove(toDelete.id);
    setToDelete(null);
    if (ok) void team.refresh();
  }

  // Block = set status inactive (auth denies login for inactive users); unblock = active.
  async function setStatus(m: TeamMember, status: TeamMember["status"]) {
    const ok = await update(m.id, { status });
    if (ok) void team.refresh();
  }

  const activeCount = data.filter((m) => m.status === "active").length;
  const deptCount = new Set(data.map((m) => m.department)).size;

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Everyone in the company. Admins manage access and roles.">
        {caps.manageTeam && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="size-4" /> Add member
          </Button>
        )}
      </PageHeader>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Total members" value={data.length} />
        <StatCard icon={UserCheck} label="Active" value={activeCount} />
        <StatCard icon={ShieldAlert} label="Departments" value={deptCount} />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={data.length === 0 ? "No team members yet" : "No matches"}
          description={data.length === 0 ? "Add your first team member to get started." : "Try a different search or filter."}
          action={caps.manageTeam && data.length === 0 ? <Button onClick={openAdd}><Plus className="size-4" /> Add member</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Plans</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Last active</TableHead>
                {caps.manageTeam && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const blocked = m.status === "inactive";
                const dot = m.status === "active" ? "bg-success" : m.status === "invited" ? "bg-warning" : "bg-destructive";
                const statusLabel = m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : "Blocked";
                const online = !blocked && !!m.lastActiveAt && Date.now() - new Date(m.lastActiveAt).getTime() < ONLINE_WINDOW_MS;
                return (
                  <TableRow key={m.id} className={cn(blocked && "opacity-60")}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <UserAvatar name={m.name} src={m.avatar} className="size-9" />
                          <span
                            title={online ? "Online" : "Offline"}
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card",
                              online ? "bg-success" : "bg-muted-foreground/40",
                              online && "pulse-ring"
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-tight">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.title || roleLabel(m.role)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{roleLabel(m.role)}</Badge></TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{m.department}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{m.email}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(() => {
                        const n = (contentByMember.get(m.id) ?? []).length;
                        return n > 0 ? (
                          <button
                            onClick={() => setContentMember(m)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <CalendarRange className="size-3.5" /> {n}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
                        <span className={cn("size-1.5 rounded-full", dot)} />
                        {statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm tabular-nums lg:table-cell">
                      {online ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-success">
                          <span className="size-1.5 rounded-full bg-success" /> Online
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{m.lastActiveAt ? relativeTime(m.lastActiveAt) : "—"}</span>
                      )}
                    </TableCell>
                    {caps.manageTeam && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(m)}><Pencil /> Edit</DropdownMenuItem>
                            {m.id !== user.id && (
                              blocked ? (
                                <DropdownMenuItem onClick={() => setStatus(m, "active")}><Unlock /> Unblock login</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setStatus(m, "inactive")}><Ban /> Block from login</DropdownMenuItem>
                              )
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={m.id === user.id}
                              onClick={() => setToDelete(m)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="!text-destructive" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit member" : "Add team member"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this member's details and access." : "Create a login for a new team member. They'll sign in with this email and password."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name" className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Cooper" />
            </Field>
            <Field label="Email" className="col-span-2">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@auradigitalservices.in" />
            </Field>
            <Field label={editing ? "New password (optional)" : "Password"} className="col-span-2">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="Role">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roleOptions.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Department">
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departmentOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Job title" className="col-span-2">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Engineer" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 …" />
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" />
            </Field>
            <Field label="Status" className="col-span-2">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TeamMember["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.email || (!editing && !form.password)} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {toDelete?.name}?</DialogTitle>
            <DialogDescription>This permanently revokes their access and deletes the account. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member content plans */}
      <Dialog open={!!contentMember} onOpenChange={(o) => !o && setContentMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{contentMember?.name}&apos;s content</DialogTitle>
            <DialogDescription>Content plans assigned to this member.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {(contentMember ? contentByMember.get(contentMember.id) ?? [] : [])
              .slice()
              .sort((a, b) => (a.date < b.date ? -1 : 1))
              .map((c) => {
                const type = CONTENT_TYPES.find((t) => t.id === c.type);
                const scope = CONTENT_SCOPES.find((s) => s.id === c.scope);
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: type?.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {type?.label} · {scope?.label}{c.date ? ` · ${c.date}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
          </ul>
          <DialogFooter>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href="/content">Open content planner <ArrowRight className="size-4" /></Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
