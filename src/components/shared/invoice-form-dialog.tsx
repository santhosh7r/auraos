"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn, toBaseUSD, fromBaseUSD, formatCurrency, CURRENCY_META } from "@/lib/utils";
import { useCurrency } from "@/components/providers/currency-provider";
import type { Invoice, Client, Project, InvoiceStatus } from "@/lib/types";
import { Loader2 } from "lucide-react";

const STATUSES: { id: InvoiceStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "paid", label: "Paid" },
  { id: "overdue", label: "Overdue" },
];

/** Next sequential invoice number for a year, formatted W<year>-<NNNN>. */
export function nextInvoiceNumber(invoices: Invoice[], year: number): string {
  const prefix = `W${year}`;
  let max = 0;
  for (const inv of invoices) {
    const num = inv.number ?? "";
    if (!num.startsWith(prefix)) continue;
    const m = /(\d+)\s*$/.exec(num);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

type FormState = {
  year: string; clientId: string; projectId: string;
  amount: string; status: InvoiceStatus; issueDate: string; dueDate: string;
};

export type InvoicePayload = {
  number: string; clientId: string; projectId: string;
  amount: number; status: InvoiceStatus; issueDate: string; dueDate: string;
};

export function InvoiceFormDialog({
  open, onOpenChange, editing, invoices, clients, projects, onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Invoice | null;
  invoices: Invoice[];
  clients: Client[];
  projects: Project[];
  onSave: (payload: InvoicePayload) => Promise<unknown | null>;
}) {
  const { currency } = useCurrency();
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

  function initialForm(): FormState {
    if (editing) {
      return {
        year: /(\d{4})/.exec(editing.number)?.[1] ?? String(thisYear),
        clientId: editing.clientId,
        projectId: editing.projectId ?? "",
        amount: editing.amount ? String(Math.round(fromBaseUSD(editing.amount))) : "",
        status: editing.status,
        issueDate: editing.issueDate?.slice(0, 10) ?? "",
        dueDate: editing.dueDate?.slice(0, 10) ?? "",
      };
    }
    return {
      year: String(thisYear), clientId: clients[0]?.id ?? "", projectId: "",
      amount: "", status: "draft", issueDate: "", dueDate: "",
    };
  }

  const [form, setForm] = React.useState<FormState>(initialForm);
  const [saving, setSaving] = React.useState(false);

  // Reset the form each time the dialog transitions to open, seeded from the
  // edited invoice (if any). Adjusting state during render is React's recommended
  // way to reset on a prop change — no effect, no cascading render.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initialForm());
  }

  // On create the number is derived from the chosen year; on edit it stays fixed.
  const number = editing ? editing.number : nextInvoiceNumber(invoices, Number(form.year));

  // Project billing summary — when a project is chosen, show its amount, how
  // much has already been invoiced against it, and the running balance so
  // split billing (e.g. 50/30/20) is easy to track. All maths in USD base.
  const project = form.projectId ? projects.find((p) => p.id === form.projectId) : undefined;
  const projectBudget = project?.budget ?? 0;
  const invoicedBefore = invoices
    .filter((i) => i.projectId === form.projectId && (!editing || i.id !== editing.id))
    .reduce((s, i) => s + (i.amount || 0), 0);
  const thisAmount = Math.round(toBaseUSD(Number(form.amount) || 0));
  const invoicedAfter = invoicedBefore + thisAmount;
  const remaining = projectBudget - invoicedAfter;
  const over = remaining < 0;

  async function submit() {
    if (!form.clientId) return;
    setSaving(true);
    const res = await onSave({
      number,
      clientId: form.clientId,
      projectId: form.projectId,
      amount: Math.round(toBaseUSD(Number(form.amount) || 0)),
      status: form.status,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
    });
    setSaving(false);
    if (res) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the invoice details and payment status." : "Raise an invoice against a client and track its payment status."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Year">
            <Select
              value={form.year}
              onValueChange={(v) => setForm({ ...form, year: v })}
              disabled={!!editing}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Invoice number">
            <Input value={number} readOnly disabled className="font-medium tabular-nums" />
          </Field>
          <Field label="Client" className="col-span-2">
            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v, projectId: "" })}>
              <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project (optional)" className="col-span-2">
            <Select value={form.projectId || "none"} onValueChange={(v) => setForm({ ...form, projectId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects
                  .filter((p) => !form.clientId || p.clientId === form.clientId)
                  .map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Amount (${CURRENCY_META[currency].symbol})`} className="col-span-2">
            <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="10000" />
          </Field>

          {/* Project billing summary — only when a project with an amount is picked */}
          {project && projectBudget > 0 && (
            <div className="col-span-2 space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Project amount</span>
                <span className="font-semibold tabular-nums">{formatCurrency(projectBudget)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Already invoiced</span>
                <span className="tabular-nums">{formatCurrency(invoicedBefore)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This invoice</span>
                <span className="tabular-nums">{thisAmount > 0 ? formatCurrency(thisAmount) : "—"}</span>
              </div>
              <div className="my-1 border-t border-border/60" />
              <div className="flex items-center justify-between text-sm">
                <span className={cn("font-medium", over ? "text-[hsl(38_92%_62%)]" : "text-foreground")}>
                  {over ? "Over project amount" : "Balance remaining"}
                </span>
                <span className={cn("font-semibold tabular-nums", over ? "text-[hsl(38_92%_62%)]" : "text-foreground")}>
                  {over ? `+${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
                </span>
              </div>
            </div>
          )}
          {project && projectBudget === 0 && (
            <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
              This project has no amount set, so no balance can be tracked.
            </p>
          )}
          <Field label="Status" className="col-span-2">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InvoiceStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Issue date">
            <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.clientId} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Create invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
