"use client";

import * as React from "react";
import { useResource } from "@/lib/use-resource";
import { useConfig } from "@/lib/use-config";
import { useSession } from "@/components/providers/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Panel } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { InvoiceFormDialog, type InvoicePayload } from "@/components/shared/invoice-form-dialog";
import { DonutChart, BarSeries } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  EXPENSE_CATEGORIES,
  type Invoice, type InvoiceStatus, type Expense, type ExpenseCategory, type Client, type Project,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Plus, Lock, MoreHorizontal, Pencil, Trash2, Loader2, CheckCircle2,
  DollarSign, Clock, Receipt, TrendingUp, FileText, Wallet,
} from "lucide-react";

const accent = "hsl(var(--brand))";
const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];

/* ---------------- Expense form ---------------- */
type ExpenseForm = {
  category: ExpenseCategory; vendor: string; amount: string; date: string; notes: string;
};
const EMPTY_EXPENSE: ExpenseForm = {
  category: "Software", vendor: "", amount: "", date: "", notes: "",
};

export default function FinancePage() {
  const { caps } = useSession();

  if (!caps.viewFinance) {
    return (
      <div className="space-y-6">
        <PageHeader title="Finance" description="Invoices, expenses and profitability." />
        <EmptyState
          icon={Lock}
          title="Restricted"
          description="Finance is available to admins and the finance team only."
        />
      </div>
    );
  }

  return <FinanceInner canCreate={caps.generateInvoice} />;
}

function FinanceInner({ canCreate }: { canCreate: boolean }) {
  const config = useConfig();
  const categoryOptions = config.expenseCategories ?? EXPENSE_CATEGORIES;
  const invoices = useResource<Invoice>("/api/r/invoices");
  const expenses = useResource<Expense>("/api/r/expenses");
  const clients = useResource<Client>("/api/r/clients");
  const projects = useResource<Project>("/api/r/projects");

  const clientName = React.useCallback(
    (id: string) => clients.data.find((c) => c.id === id)?.name ?? "—",
    [clients.data]
  );

  /* ---- KPIs ---- */
  const revenue = invoices.data.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const outstanding = invoices.data
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.data.reduce((s, e) => s + e.amount, 0);
  const profit = revenue - totalExpenses;

  /* ---- Charts ---- */
  // Configured categories plus any legacy category still present in the data.
  const chartCategories = [
    ...categoryOptions,
    ...expenses.data.map((e) => e.category).filter((c) => !categoryOptions.includes(c)),
  ].filter((c, i, arr) => arr.indexOf(c) === i);
  const expensesByCategory = chartCategories.map((cat) => ({
    label: cat,
    value: expenses.data.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((d) => d.value > 0);

  const invoicesByStatus = INVOICE_STATUSES.map((st) => ({
    label: st.charAt(0).toUpperCase() + st.slice(1),
    amount: invoices.data.filter((i) => i.status === st).reduce((s, i) => s + i.amount, 0),
  }));

  /* ---- Invoice dialog state ---- */
  const [invDialog, setInvDialog] = React.useState(false);
  const [editInv, setEditInv] = React.useState<Invoice | null>(null);
  const [invDelete, setInvDelete] = React.useState<Invoice | null>(null);

  /* ---- Expense dialog state ---- */
  const [expDialog, setExpDialog] = React.useState(false);
  const [editExp, setEditExp] = React.useState<Expense | null>(null);
  const [expForm, setExpForm] = React.useState<ExpenseForm>(EMPTY_EXPENSE);
  const [expSaving, setExpSaving] = React.useState(false);
  const [expDelete, setExpDelete] = React.useState<Expense | null>(null);

  function openAddInvoice() {
    setEditInv(null);
    setInvDialog(true);
  }
  function openEditInvoice(i: Invoice) {
    setEditInv(i);
    setInvDialog(true);
  }
  const saveInvoice = (payload: InvoicePayload) =>
    editInv ? invoices.update(editInv.id, payload) : invoices.create(payload);
  async function confirmDeleteInvoice() {
    if (!invDelete) return;
    await invoices.remove(invDelete.id);
    setInvDelete(null);
  }

  function openAddExpense() {
    setEditExp(null);
    setExpForm(EMPTY_EXPENSE);
    setExpDialog(true);
  }
  function openEditExpense(e: Expense) {
    setEditExp(e);
    setExpForm({
      category: e.category, vendor: e.vendor, amount: String(e.amount),
      date: e.date?.slice(0, 10) ?? "", notes: e.notes ?? "",
    });
    setExpDialog(true);
  }
  async function saveExpense() {
    if (!expForm.vendor || !expForm.amount) return;
    setExpSaving(true);
    const payload: Record<string, unknown> = {
      category: expForm.category,
      vendor: expForm.vendor,
      amount: Number(expForm.amount),
      date: expForm.date,
      notes: expForm.notes,
    };
    const res = editExp ? await expenses.update(editExp.id, payload) : await expenses.create(payload);
    setExpSaving(false);
    if (res) setExpDialog(false);
  }
  async function confirmDeleteExpense() {
    if (!expDelete) return;
    await expenses.remove(expDelete.id);
    setExpDelete(null);
  }

  const loading = invoices.loading || expenses.loading || clients.loading;

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Invoices, expenses and profitability.">
        {canCreate && (
          <Button onClick={openAddInvoice} className="gap-2">
            <Plus className="size-4" /> New invoice
          </Button>
        )}
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard index={0} label="Revenue" value={formatCurrency(revenue)} icon={DollarSign} accent="hsl(var(--success))" hint="Paid invoices" />
        <KpiCard index={1} label="Outstanding" value={formatCurrency(outstanding)} icon={Clock} accent="hsl(var(--warning))" hint="Sent + overdue" />
        <KpiCard index={2} label="Expenses" value={formatCurrency(totalExpenses)} icon={Receipt} accent={accent} hint="All categories" />
        <KpiCard index={3} label="Profit" value={formatCurrency(profit)} icon={TrendingUp} accent={profit >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} hint="Revenue − expenses" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Expenses by category" description="Spend distribution across categories">
          {loading ? (
            <Skeleton className="h-60 w-full" />
          ) : expensesByCategory.length === 0 ? (
            <EmptyState icon={Wallet} title="No expenses yet" className="border-0 py-10" />
          ) : (
            <DonutChart data={expensesByCategory} currency />
          )}
        </Panel>
        <Panel title="Invoices by status" description="Billed amount per status">
          {loading ? (
            <Skeleton className="h-60 w-full" />
          ) : invoices.data.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" className="border-0 py-10" />
          ) : (
            <BarSeries
              data={invoicesByStatus}
              keys={[{ key: "amount", color: accent, label: "Amount" }]}
              currency
              height={240}
            />
          )}
        </Panel>
      </div>

      {/* Tables */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* ---- Invoices ---- */}
        <TabsContent value="invoices">
          <Panel>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : invoices.data.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Create your first invoice to start tracking billing."
                action={canCreate ? <Button onClick={openAddInvoice} className="gap-2"><Plus className="size-4" /> New invoice</Button> : undefined}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.data.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.number}</TableCell>
                      <TableCell>{clientName(i.clientId)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(i.amount)}</TableCell>
                      <TableCell><InvoiceStatusBadge status={i.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{i.issueDate ? formatDate(i.issueDate) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{i.dueDate ? formatDate(i.dueDate) : "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditInvoice(i)}><Pencil /> Edit</DropdownMenuItem>
                            {i.status !== "paid" && (
                              <DropdownMenuItem onClick={() => void invoices.update(i.id, { status: "paid" })}>
                                <CheckCircle2 /> Mark paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setInvDelete(i)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="!text-destructive" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>

        {/* ---- Expenses ---- */}
        <TabsContent value="expenses">
          <Panel
            action={
              <Button onClick={openAddExpense} variant="outline" size="sm" className="gap-2">
                <Plus className="size-4" /> Add expense
              </Button>
            }
            title="Expenses"
          >
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : expenses.data.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No expenses yet"
                description="Log company expenses to track spend and profitability."
                action={<Button onClick={openAddExpense} className="gap-2"><Plus className="size-4" /> Add expense</Button>}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.category}</TableCell>
                      <TableCell>{e.vendor}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(e.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{e.date ? formatDate(e.date) : "—"}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{e.notes || "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditExpense(e)}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setExpDelete(e)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="!text-destructive" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {/* ---- Invoice add/edit dialog ---- */}
      <InvoiceFormDialog
        open={invDialog}
        onOpenChange={setInvDialog}
        editing={editInv}
        invoices={invoices.data}
        clients={clients.data}
        projects={projects.data}
        onSave={saveInvoice}
      />

      {/* ---- Expense add/edit dialog ---- */}
      <Dialog open={expDialog} onOpenChange={setExpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editExp ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>
              {editExp ? "Update this expense record." : "Log a new company expense."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={expForm.category} onValueChange={(v) => setExpForm({ ...expForm, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {/* Keep the existing value selectable even if removed from config. */}
                  {expForm.category && !categoryOptions.includes(expForm.category) && (
                    <SelectItem value={expForm.category}>{expForm.category}</SelectItem>
                  )}
                  {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount">
              <Input type="number" min="0" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Vendor" className="col-span-2">
              <Input value={expForm.vendor} onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })} placeholder="e.g. Figma, AWS" />
            </Field>
            <Field label="Date" className="col-span-2">
              <Input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <Textarea value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} placeholder="Optional details" />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExpDialog(false)}>Cancel</Button>
            <Button onClick={saveExpense} disabled={expSaving || !expForm.vendor || !expForm.amount} className="gap-2">
              {expSaving && <Loader2 className="size-4 animate-spin" />}
              {editExp ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirms ---- */}
      <Dialog open={!!invDelete} onOpenChange={(o) => !o && setInvDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {invDelete?.number}?</DialogTitle>
            <DialogDescription>This permanently removes the invoice. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteInvoice}>Delete invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!expDelete} onOpenChange={(o) => !o && setExpDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>This permanently removes the {expDelete?.category.toLowerCase()} expense from {expDelete?.vendor}. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExpDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteExpense}>Delete expense</Button>
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
