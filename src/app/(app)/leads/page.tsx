"use client";

import * as React from "react";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadStatusBadge } from "@/components/shared/badges";
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LEAD_STAGES, LEAD_SOURCES, LEAD_SERVICES,
  type Lead, type LeadStatus, type LeadSource, type LeadService, type Priority,
} from "@/lib/types";
import { cn, formatCurrency, formatDate, toBaseUSD, fromBaseUSD, CURRENCY_META } from "@/lib/utils";
import { useCurrency } from "@/components/providers/currency-provider";
import { useConfig } from "@/lib/use-config";
import {
  Plus, Search, Target, Trophy, Users, Percent, MoreHorizontal,
  Pencil, Trash2, Loader2,
} from "lucide-react";

type FormState = {
  name: string; company: string; email: string; phone: string; website: string;
  source: LeadSource; service: LeadService; status: LeadStatus; priority: Priority;
  value: number; assignedTo: string; followUpDate: string; tags: string; notes: string;
};

const EMPTY: FormState = {
  name: "", company: "", email: "", phone: "", website: "",
  source: "Website", service: "Website", status: "new", priority: "medium",
  value: 0, assignedTo: "", followUpDate: "", tags: "", notes: "",
};

export default function LeadsPage() {
  const { caps } = useSession();
  const { byId } = useTeam();
  const { currency } = useCurrency();
  const config = useConfig();
  const serviceOptions: string[] = config.leadServices ?? LEAD_SERVICES;
  const sourceOptions: string[] = config.leadSources ?? LEAD_SOURCES;
  const { data, loading, create, update, remove } = useResource<Lead>("/api/r/leads");

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Lead | null>(null);

  // Drag a lead card to another stage column to move it.
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  // When a lead is moved to "Won" we confirm, then add them to Clients.
  const [wonLead, setWonLead] = React.useState<Lead | null>(null);
  const [converting, setConverting] = React.useState(false);

  // Stats
  const openPipeline = data
    .filter((l) => l.status !== "won" && l.status !== "lost")
    .reduce((s, l) => s + (l.value || 0), 0);
  const wonValue = data.filter((l) => l.status === "won").reduce((s, l) => s + (l.value || 0), 0);
  const wonCount = data.filter((l) => l.status === "won").length;
  const lostCount = data.filter((l) => l.status === "lost").length;
  const conversion = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null;

  const filtered = data.filter((l) => {
    const q = search.toLowerCase();
    const matchQ = !q || l.company.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || l.status === statusFilter;
    return matchQ && matchS;
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }
  function openEdit(l: Lead) {
    setEditing(l);
    setForm({
      name: l.name, company: l.company, email: l.email, phone: l.phone, website: l.website ?? "",
      source: l.source, service: l.service ?? "Other", status: l.status, priority: l.priority ?? "medium",
      value: Math.round(fromBaseUSD(l.value)), assignedTo: l.assignedTo, followUpDate: l.followUpDate ?? "",
      tags: (l.tags ?? []).join(", "), notes: l.notes,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    const payload = {
      ...form,
      value: Math.round(toBaseUSD(Number(form.value) || 0)),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
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

  function moveStage(l: Lead, status: LeadStatus) {
    if (l.status === status) return;
    // Moving to Won → confirm, then convert to a client.
    if (status === "won") {
      setWonLead(l);
      return;
    }
    void update(l.id, { status });
  }

  async function confirmWin() {
    if (!wonLead) return;
    setConverting(true);
    const l = wonLead;
    // Add the won lead to the client roster.
    await fetch("/api/r/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: l.company || l.name,
        email: l.email,
        phone: l.phone,
        website: l.website ?? "",
        status: "active",
        health: "green",
        accountManager: l.assignedTo,
        notes: l.notes,
      }),
    }).catch(() => {});
    await update(l.id, { status: "won" });
    setConverting(false);
    setWonLead(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Your sales pipeline from first touch to closed deal.">
        {caps.manageLeads && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="size-4" /> Add lead
          </Button>
        )}
      </PageHeader>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Target} label="Open pipeline" value={formatCurrency(openPipeline, { compact: true })} />
        <StatCard icon={Trophy} label="Won value" value={formatCurrency(wonValue, { compact: true })} />
        <StatCard icon={Users} label="Total leads" value={String(data.length)} />
        <StatCard icon={Percent} label="Conversion" value={conversion === null ? "—" : `${conversion}%`} />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {LEAD_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pipeline */}
        <TabsContent value="pipeline">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No leads yet"
              description="Add your first lead to start building the pipeline."
              action={caps.manageLeads ? <Button onClick={openAdd} className="gap-2"><Plus className="size-4" /> Add lead</Button> : undefined}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {LEAD_STAGES.map((stage) => {
                const stageLeads = filtered.filter((l) => l.status === stage.id);
                const stageValue = stageLeads.reduce((s, l) => s + (l.value || 0), 0);
                return (
                  <div
                    key={stage.id}
                    onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== stage.id) setDragOverCol(stage.id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                    onDrop={(e) => { e.preventDefault(); if (dragId) { const l = data.find((x) => x.id === dragId); if (l) moveStage(l, stage.id); } setDragId(null); setDragOverCol(null); }}
                    className="flex min-w-0 flex-col"
                  >
                    <div className="rounded-t-2xl border border-b-0 border-border bg-card px-4 pt-3 pb-2">
                      <div className="h-0.5 w-8 rounded-full bg-muted-foreground/30" />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold">{stage.label}</span>
                        <Badge variant="muted" className="tabular-nums">{stageLeads.length}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(stageValue, { compact: true })}
                      </p>
                    </div>
                    <div className={cn(
                      "flex-1 space-y-2.5 rounded-b-2xl border border-t-0 border-border bg-muted/20 p-2.5 transition-colors",
                      dragOverCol === stage.id && "border-brand/50 bg-brand/[0.06]"
                    )}>
                      {stageLeads.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">No leads</p>
                      ) : (
                        stageLeads.map((l) => {
                          const assignee = byId(l.assignedTo);
                          return (
                            <div
                              key={l.id}
                              draggable={caps.manageLeads}
                              onDragStart={(e) => { setDragId(l.id); e.dataTransfer.effectAllowed = "move"; }}
                              onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                              className={cn(
                                "group rounded-xl border border-border bg-card p-3 transition-colors hover:border-[hsl(0_0%_23%)]",
                                caps.manageLeads && "cursor-grab active:cursor-grabbing",
                                dragId === l.id && "opacity-50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold leading-tight">{l.company || "—"}</p>
                                  <p className="truncate text-xs text-muted-foreground">{l.name}</p>
                                </div>
                                {caps.manageLeads && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEdit(l)}><Pencil /> Edit</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setToDelete(l)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="!text-destructive" /> Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                              <p className="mt-2 text-sm font-bold tabular-nums">{formatCurrency(l.value || 0, { compact: true })}</p>
                              <div className="mt-2.5 flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px]">{l.source}</Badge>
                                {assignee && <UserAvatar name={assignee.name} src={assignee.avatar} className="size-6" />}
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
          )}
        </TabsContent>

        {/* Table */}
        <TabsContent value="table">
          {loading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Target}
              title={data.length === 0 ? "No leads yet" : "No matches"}
              description={data.length === 0 ? "Add your first lead to start building the pipeline." : "Try a different search or filter."}
              action={caps.manageLeads && data.length === 0 ? <Button onClick={openAdd} className="gap-2"><Plus className="size-4" /> Add lead</Button> : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-premium">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company / Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Created</TableHead>
                    {caps.manageLeads && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const assignee = byId(l.assignedTo);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <p className="font-medium">{l.company || "—"}</p>
                          <p className="text-xs text-muted-foreground">{l.name}</p>
                        </TableCell>
                        <TableCell><LeadStatusBadge status={l.status} /></TableCell>
                        <TableCell><Badge variant="outline">{l.source}</Badge></TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(l.value || 0, { compact: true })}</TableCell>
                        <TableCell>
                          {assignee ? (
                            <span className="inline-flex items-center gap-2">
                              <UserAvatar name={assignee.name} src={assignee.avatar} className="size-6" />
                              <span className="text-sm">{assignee.name}</span>
                            </span>
                          ) : <span className="text-sm text-muted-foreground">Unassigned</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">{formatDate(l.createdAt)}</TableCell>
                        {caps.manageLeads && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm"><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(l)}><Pencil /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setToDelete(l)} className="text-destructive focus:text-destructive">
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
        </TabsContent>
      </Tabs>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lead" : "Add lead"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this lead's details and stage." : "Capture a new sales opportunity."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Lead Information */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">Lead Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name *" className="col-span-2">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Cooper" />
                </Field>
                <Field label="Company name" className="col-span-2">
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc." />
                </Field>
                <Field label="Phone number">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@acme.com" />
                </Field>
              </div>
            </section>

            {/* Opportunity */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">Opportunity</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Service interested">
                  <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v as LeadService })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Lead source">
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sourceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={`Estimated value (${CURRENCY_META[currency].symbol})`}>
                  <Input
                    type="number"
                    min={0}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value === "" ? 0 : Number(e.target.value) })}
                    placeholder="0"
                  />
                </Field>
                <Field label="Stage">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAD_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            {/* Follow-up */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">Follow-up</h3>
              <Field label="Next follow-up date">
                <Input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
              </Field>
            </section>

            {/* Notes */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">Notes</h3>
              <Field label="Requirements / notes">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Project requirements, context, next steps…" />
              </Field>
            </section>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Won → convert to client confirm */}
      <Dialog open={!!wonLead} onOpenChange={(o) => !o && setWonLead(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as won?</DialogTitle>
            <DialogDescription>
              Move {wonLead?.company || wonLead?.name || "this lead"} to <strong className="font-medium text-foreground">Won</strong> and add them to your Clients as an active account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWonLead(null)}>Cancel</Button>
            <Button onClick={confirmWin} disabled={converting} className="gap-2">
              {converting && <Loader2 className="size-4 animate-spin" />}
              Confirm & add client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove lead?</DialogTitle>
            <DialogDescription>
              This permanently deletes {toDelete?.company || toDelete?.name || "this lead"}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove lead</Button>
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
