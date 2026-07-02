"use client";

import * as React from "react";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/components/providers/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceFormDialog, type InvoicePayload } from "@/components/shared/invoice-form-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, Client, Project, InvoiceStatus } from "@/lib/types";
import { Plus, Receipt, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export default function InvoicesPage() {
  const { caps } = useSession();
  const { data: invoices, loading, create, update, remove } = useResource<Invoice>("/api/r/invoices");
  const clients = useResource<Client>("/api/r/clients");
  const projects = useResource<Project>("/api/r/projects");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Invoice | null>(null);
  const [toDelete, setToDelete] = React.useState<Invoice | null>(null);

  const clientName = (id: string) => clients.data.find((c) => c.id === id)?.name ?? "—";
  const sum = (s: InvoiceStatus) => invoices.filter((i) => i.status === s).reduce((a, b) => a + b.amount, 0);
  const totals = [
    { label: "Paid", value: sum("paid") },
    { label: "Outstanding", value: sum("sent") + sum("overdue") },
    { label: "Draft", value: sum("draft") },
  ];

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(inv: Invoice) {
    setEditing(inv);
    setDialogOpen(true);
  }
  const onSave = (payload: InvoicePayload) =>
    editing ? update(editing.id, payload) : create(payload);

  async function confirmDelete() {
    if (!toDelete) return;
    await remove(toDelete.id);
    setToDelete(null);
  }

  return (
    <div>
      <PageHeader title="Invoices" description="Every invoice across all clients, with live payment status.">
        {caps.generateInvoice && (
          <Button onClick={openAdd} className="gap-2"><Plus className="size-4" /> New invoice</Button>
        )}
      </PageHeader>

      {loading ? (
        <Skeleton className="h-96" />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Create your first invoice to start tracking revenue and outstanding payments."
          action={caps.generateInvoice ? <Button onClick={openAdd}><Plus className="size-4" /> New invoice</Button> : undefined}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {totals.map((t) => (
              <div key={t.label} className="rounded-2xl border border-border p-5">
                <p className="text-[13px] text-muted-foreground">{t.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(t.value, { compact: true })}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Issued</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Due</th>
                  {caps.generateInvoice && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id} className={`group transition-colors hover:bg-accent/40 ${i > 0 ? "border-t border-border" : ""}`}>
                    <td className="px-5 py-3.5 font-medium tabular-nums">{inv.number}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{clientName(inv.clientId)}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums">{formatCurrency(inv.amount)}</td>
                    <td className="px-5 py-3.5"><InvoiceStatusBadge status={inv.status} /></td>
                    <td className="hidden px-5 py-3.5 text-muted-foreground md:table-cell">{inv.issueDate ? formatDate(inv.issueDate) : "—"}</td>
                    <td className="hidden px-5 py-3.5 text-muted-foreground md:table-cell">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</td>
                    {caps.generateInvoice && (
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(inv)}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setToDelete(inv)} className="text-destructive focus:text-destructive">
                              <Trash2 className="!text-destructive" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <InvoiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        invoices={invoices}
        clients={clients.data}
        projects={projects.data}
        onSave={onSave}
      />

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove invoice {toDelete?.number}?</DialogTitle>
            <DialogDescription>This permanently deletes the invoice. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
