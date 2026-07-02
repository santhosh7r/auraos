"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useResource } from "@/lib/use-resource";
import { useConfig } from "@/lib/use-config";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HealthDot } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/avatar";
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
import { INDUSTRIES, type Client, type ClientStatus, type ClientHealth } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  Building2, ShieldCheck, Users, AlertTriangle, Plus, Search, Globe,
  MoreHorizontal, Pencil, Trash2, Loader2,
} from "lucide-react";

const HEALTH_LABEL: Record<ClientHealth, string> = {
  green: "Healthy", yellow: "At Risk", red: "Critical",
};
const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active", prospect: "Prospect", archived: "Archived",
};

type FormState = {
  name: string; industry: string; email: string; phone: string; website: string;
  status: ClientStatus; health: ClientHealth; accountManager: string;
  address: string; notes: string;
};

const EMPTY: FormState = {
  name: "", industry: "", email: "", phone: "", website: "",
  status: "prospect", health: "green", accountManager: "",
  address: "", notes: "",
};

export default function ClientsPage() {
  const { caps } = useSession();
  const { members, byId } = useTeam();
  const config = useConfig();
  const industryOptions = config.industries ?? INDUSTRIES;
  const { data, loading, create, update, remove } = useResource<Client>("/api/r/clients");

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Client | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Client | null>(null);

  const filtered = data.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || c.status === statusFilter;
    return matchQ && matchS;
  });

  const total = data.length;
  const active = data.filter((c) => c.status === "active").length;
  const prospects = data.filter((c) => c.status === "prospect").length;
  const atRisk = data.filter((c) => c.health === "red" || c.health === "yellow").length;

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }
  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name, industry: c.industry, email: c.email, phone: c.phone, website: c.website,
      status: c.status, health: c.health, accountManager: c.accountManager,
      address: c.address, notes: c.notes,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const res = editing ? await update(editing.id, { ...form }) : await create({ ...form });
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
      <PageHeader title="Clients" description="Every account, contact, and health signal in one place.">
        {caps.manageClients && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="size-4" /> Add client
          </Button>
        )}
      </PageHeader>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Total clients" value={total} />
        <StatCard icon={ShieldCheck} label="Active" value={active} />
        <StatCard icon={Users} label="Prospects" value={prospects} />
        <StatCard icon={AlertTriangle} label="At-risk" value={atRisk} />
      </div>

      <Tabs defaultValue="grid" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={data.length === 0 ? "No clients yet" : "No matches"}
            description={data.length === 0 ? "Add your first client to start tracking accounts." : "Try a different search or filter."}
            action={caps.manageClients && data.length === 0 ? <Button onClick={openAdd} className="gap-2"><Plus className="size-4" /> Add client</Button> : undefined}
          />
        ) : (
          <>
            {/* Grid */}
            <TabsContent value="grid">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c, i) => {
                  const am = byId(c.accountManager);
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03 }}
                    >
                      <div className="group relative h-full rounded-2xl border border-border bg-card p-5 transition-colors hover:border-[hsl(0_0%_23%)]">
                        <Link href={`/clients/${c.id}`} className="absolute inset-0 rounded-2xl" aria-label={c.name} />
                        <div className="relative flex items-start gap-3">
                          <UserAvatar mono name={c.name} className="size-11 rounded-xl" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium leading-tight">{c.name}</p>
                            <p className="truncate text-[13px] text-muted-foreground">{c.industry || "—"}</p>
                          </div>
                          {caps.manageClients && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="relative -mr-1 -mt-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(c)}><Pencil /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setToDelete(c)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="!text-destructive" /> Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <HealthDot health={c.health} />
                            {c.health === "green" ? "Healthy" : c.health === "yellow" ? "At risk" : "Critical"}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{STATUS_LABEL[c.status]}</span>
                        </div>

                        <div className="relative mt-4 flex items-center gap-2 border-t border-border pt-4">
                          {am ? (
                            <>
                              <UserAvatar mono name={am.name} src={am.avatar} className="size-6" />
                              <span className="truncate text-xs text-muted-foreground">{am.name}</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                          {c.website && (
                            <a
                              href={normalizeUrl(c.website)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="relative ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Globe className="size-3.5" /> Website
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Table */}
            <TabsContent value="table">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-premium">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Account Manager</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const am = byId(c.accountManager);
                      return (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer"
                          onClick={() => { window.location.href = `/clients/${c.id}`; }}
                        >
                          <TableCell>
                            <span className="flex items-center gap-3">
                              <UserAvatar mono name={c.name} className="size-8 rounded-lg" />
                              <span className="font-medium">{c.name}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{STATUS_LABEL[c.status]}</Badge></TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 text-sm">
                              <HealthDot health={c.health} /> {HEALTH_LABEL[c.health]}
                            </span>
                          </TableCell>
                          <TableCell>
                            {am ? (
                              <span className="inline-flex items-center gap-2">
                                <UserAvatar mono name={am.name} src={am.avatar} className="size-6" />
                                <span className="text-sm">{am.name}</span>
                              </span>
                            ) : <span className="text-sm text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">{formatDate(c.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this account's details." : "Create a new client account."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name" className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Inc." />
            </Field>
            <Field label="Industry" className="col-span-2">
              <Select value={form.industry || "none"} onValueChange={(v) => setForm({ ...form, industry: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select an industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unspecified</SelectItem>
                  {/* Keep the existing value selectable even if it was removed from config. */}
                  {form.industry && !industryOptions.includes(form.industry) && (
                    <SelectItem value={form.industry}>{form.industry}</SelectItem>
                  )}
                  {industryOptions.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hello@acme.com" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 …" />
            </Field>
            <Field label="Website" className="col-span-2">
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="acme.com" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ClientStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Health">
              <Select value={form.health} onValueChange={(v) => setForm({ ...form, health: v as ClientHealth })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Healthy</SelectItem>
                  <SelectItem value="yellow">At Risk</SelectItem>
                  <SelectItem value="red">Critical</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Account manager" className="col-span-2">
              <Select value={form.accountManager || "none"} onValueChange={(v) => setForm({ ...form, accountManager: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Address" className="col-span-2">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Market St, City" />
            </Field>
            <Field label="Notes" className="col-span-2">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything worth remembering…" />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {toDelete?.name}?</DialogTitle>
            <DialogDescription>This permanently deletes the client record. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
