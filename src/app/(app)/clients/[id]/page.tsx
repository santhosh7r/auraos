"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { Panel } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { HealthBadge, ProjectStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import type { Client, ClientStatus, ClientHealth, Project } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2, ArrowLeft, Pencil, Globe, Mail, Phone, MapPin, FileText,
  UserCog, CalendarDays, FolderKanban, Loader2,
} from "lucide-react";

const STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active", prospect: "Prospect", archived: "Archived",
};
const STATUS_VARIANT: Record<ClientStatus, "success" | "secondary" | "muted"> = {
  active: "success", prospect: "secondary", archived: "muted",
};

type FormState = {
  name: string; industry: string; email: string; phone: string; website: string;
  status: ClientStatus; health: ClientHealth; accountManager: string;
  address: string; notes: string;
};

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { caps } = useSession();
  const { members, byId } = useTeam();

  const [client, setClient] = React.useState<Client | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [projects, setProjects] = React.useState<Project[]>([]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);

  const loadClient = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/r/clients/${id}`);
      if (res.ok) {
        const json = await res.json();
        setClient(json.data as Client);
      } else {
        setClient(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void loadClient(); }, [loadClient]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/r/projects");
      if (res.ok && active) {
        const json = await res.json();
        setProjects((json.data as Project[]).filter((p) => p.clientId === id));
      }
    })();
    return () => { active = false; };
  }, [id]);

  function openEdit() {
    if (!client) return;
    setForm({
      name: client.name, industry: client.industry, email: client.email,
      phone: client.phone, website: client.website, status: client.status,
      health: client.health, accountManager: client.accountManager,
      address: client.address, notes: client.notes,
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form || !form.name) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/r/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setClient(json.data as Client);
      toast.success("Saved");
      setEditOpen(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <BackLink />
        <EmptyState
          icon={Building2}
          title="Client not found"
          description="This client doesn't exist or may have been removed."
          action={<Button asChild variant="outline"><Link href="/clients">Back to Clients</Link></Button>}
        />
      </div>
    );
  }

  const am = byId(client.accountManager);

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-2xl border border-border bg-card p-6 shadow-premium"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <UserAvatar name={client.name} className="size-14" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{client.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{client.industry || "—"}</span>
                {client.website && (
                  <>
                    <span aria-hidden>·</span>
                    <a href={normalizeUrl(client.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Globe className="size-3.5" /> {client.website}
                    </a>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <HealthBadge health={client.health} />
                <Badge variant={STATUS_VARIANT[client.status]}>{STATUS_LABEL[client.status]}</Badge>
              </div>
            </div>
          </div>
          {caps.manageClients && (
            <Button variant="outline" onClick={openEdit} className="gap-2 self-start">
              <Pencil className="size-4" /> Edit
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={UserCog} label="Account manager">
          {am ? (
            <span className="inline-flex items-center gap-2">
              <UserAvatar name={am.name} src={am.avatar} className="size-7" />
              <span className="font-semibold">{am.name}</span>
            </span>
          ) : <span className="font-semibold text-muted-foreground">Unassigned</span>}
        </StatCard>
        <StatCard icon={CalendarDays} label="Client since">
          <span className="text-lg font-bold tabular-nums">{formatDate(client.createdAt)}</span>
        </StatCard>
        <StatCard icon={FolderKanban} label="Projects">
          <span className="text-lg font-bold tabular-nums">{projects.length}</span>
        </StatCard>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Contact" className="lg:col-span-1">
              <div className="space-y-3 text-sm">
                <InfoRow icon={Mail} label="Email" value={client.email} href={client.email ? `mailto:${client.email}` : undefined} />
                <InfoRow icon={Phone} label="Phone" value={client.phone} href={client.phone ? `tel:${client.phone}` : undefined} />
                <InfoRow icon={Globe} label="Website" value={client.website} href={client.website ? normalizeUrl(client.website) : undefined} external />
                <InfoRow icon={MapPin} label="Address" value={client.address} />
              </div>
            </Panel>
            <Panel title="Notes" className="lg:col-span-2">
              {client.notes ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{client.notes}</p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="size-4" /> No notes yet.</p>
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="projects">
          {projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects" description="This client has no projects yet." />
          ) : (
            <div className="space-y-2.5">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[hsl(0_0%_23%)]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <ProjectStatusBadge status={p.status} />
                  <div className="flex w-32 items-center gap-2">
                    <Progress value={p.progress} className="h-2 flex-1" />
                    <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" /> {formatDate(p.deadline)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
            <DialogDescription>Update this account&apos;s details.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company name" className="col-span-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Industry" className="col-span-2">
                <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Website" className="col-span-2">
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
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
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="Notes" className="col-span-2">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form?.name} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to Clients
    </Link>
  );
}

function StatCard({ icon: Icon, label, children }: { icon: typeof Building2; label: string; children: React.ReactNode }) {
  return (
    <Panel bodyClassName="py-1">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-0.5">{children}</div>
        </div>
      </div>
    </Panel>
  );
}

function InfoRow({
  icon: Icon, label, value, href, external,
}: {
  icon: typeof Mail; label: string; value: string; href?: string; external?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value ? (
          href ? (
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="break-words text-brand hover:underline"
            >
              {value}
            </a>
          ) : (
            <p className="break-words">{value}</p>
          )
        ) : (
          <p className="text-muted-foreground">—</p>
        )}
      </div>
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
