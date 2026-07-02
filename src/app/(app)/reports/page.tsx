"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Panel } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { DonutChart, BarSeries, FunnelChart } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROJECT_STAGES, TASK_STATUSES, LEAD_STAGES,
  type ProjectStatus, type TaskStatus, type LeadStatus, type ClientHealth,
} from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Download, Users, FolderKanban, ListChecks, Target, TrendingUp, Trophy,
  DollarSign, Receipt, Wallet,
} from "lucide-react";

const accent = "hsl(var(--brand))";

interface Stats {
  counts: {
    clients: number; activeClients: number; projects: number; activeProjects: number;
    tasks: number; openTasks: number; leads: number; team: number;
  };
  projectsByStatus: Record<string, number>;
  tasksByStatus: Record<string, number>;
  leadsByStatus: Record<string, number>;
  clientHealth: Record<string, number>;
  avgProgress: number;
  openPipeline: number;
  wonValue: number;
  finance?: {
    revenue: number; outstanding: number; expenses: number; profit: number;
    invoicesByStatus: Record<string, number>;
  };
}

const HEALTH_META: { id: ClientHealth; label: string; color: string }[] = [
  { id: "green", label: "Healthy", color: "hsl(var(--success))" },
  { id: "yellow", label: "At Risk", color: "hsl(var(--warning))" },
  { id: "red", label: "Critical", color: "hsl(var(--destructive))" },
];

export default function ReportsPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (active && res.ok) setStats(json.data as Stats);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function exportCsv() {
    if (!stats) return;
    const rows: [string, string | number][] = [
      ["Metric", "Value"],
      ["Clients", stats.counts.clients],
      ["Active clients", stats.counts.activeClients],
      ["Projects", stats.counts.projects],
      ["Active projects", stats.counts.activeProjects],
      ["Tasks", stats.counts.tasks],
      ["Open tasks", stats.counts.openTasks],
      ["Leads", stats.counts.leads],
      ["Team", stats.counts.team],
      ["Open pipeline", stats.openPipeline],
      ["Won value", stats.wonValue],
      ["Avg project progress (%)", stats.avgProgress],
    ];
    if (stats.finance) {
      rows.push(
        ["Revenue", stats.finance.revenue],
        ["Outstanding", stats.finance.outstanding],
        ["Expenses", stats.finance.expenses],
        ["Profit", stats.finance.profit],
      );
    }
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aura-report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Company-wide analytics across delivery, sales and finance." />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Company-wide analytics across delivery, sales and finance." />
        <EmptyState icon={Target} title="No data available" description="We couldn't load analytics right now. Try again later." />
      </div>
    );
  }

  /* ---- Chart data ---- */
  const projectsData = PROJECT_STAGES.map((s: { id: ProjectStatus; label: string }) => ({
    label: s.label,
    value: stats.projectsByStatus[s.id] ?? 0,
  })).filter((d) => d.value > 0);

  const tasksData = TASK_STATUSES.map((s: { id: TaskStatus; label: string }) => ({
    label: s.label,
    count: stats.tasksByStatus[s.id] ?? 0,
  }));

  const leadsData = LEAD_STAGES.map((s: { id: LeadStatus; label: string }) => ({
    label: s.label,
    value: stats.leadsByStatus[s.id] ?? 0,
  }));

  const healthData = HEALTH_META.map((h) => ({
    label: h.label,
    value: stats.clientHealth[h.id] ?? 0,
  })).filter((d) => d.value > 0);

  const projectColors = PROJECT_STAGES.filter((s) => (stats.projectsByStatus[s.id] ?? 0) > 0).map((s) => s.color);
  const healthColors = HEALTH_META.filter((h) => (stats.clientHealth[h.id] ?? 0) > 0).map((h) => h.color);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Company-wide analytics across delivery, sales and finance.">
        <Button onClick={exportCsv} variant="outline" className="gap-2">
          <Download className="size-4" /> Export CSV
        </Button>
      </PageHeader>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard index={0} label="Clients" value={formatNumber(stats.counts.clients)} icon={Users} accent={accent} hint={`${stats.counts.activeClients} active`} />
        <KpiCard index={1} label="Projects" value={formatNumber(stats.counts.projects)} icon={FolderKanban} accent={accent} hint={`${stats.counts.activeProjects} in progress`} />
        <KpiCard index={2} label="Tasks" value={formatNumber(stats.counts.tasks)} icon={ListChecks} accent={accent} hint={`${stats.counts.openTasks} open`} />
        <KpiCard index={3} label="Leads" value={formatNumber(stats.counts.leads)} icon={Target} accent={accent} hint="In pipeline" />
        <KpiCard index={4} label="Pipeline" value={formatCurrency(stats.openPipeline)} icon={TrendingUp} accent="hsl(var(--warning))" hint="Open deal value" />
        <KpiCard index={5} label="Won" value={formatCurrency(stats.wonValue)} icon={Trophy} accent="hsl(var(--success))" hint="Closed-won value" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Projects by status" description="Distribution of all projects">
          {projectsData.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects yet" className="border-0 py-10" />
          ) : (
            <DonutChart data={projectsData} colors={projectColors} />
          )}
        </Panel>

        <Panel title="Tasks by status" description="Workload across the board">
          {stats.counts.tasks === 0 ? (
            <EmptyState icon={ListChecks} title="No tasks yet" className="border-0 py-10" />
          ) : (
            <BarSeries data={tasksData} keys={[{ key: "count", color: accent, label: "Tasks" }]} height={240} />
          )}
        </Panel>

        <Panel title="Lead pipeline" description="Conversion through each stage">
          {stats.counts.leads === 0 ? (
            <EmptyState icon={Target} title="No leads yet" className="border-0 py-10" />
          ) : (
            <FunnelChart data={leadsData} />
          )}
        </Panel>

        <Panel title="Client health" description="Account risk distribution">
          {healthData.length === 0 ? (
            <EmptyState icon={Users} title="No clients yet" className="border-0 py-10" />
          ) : (
            <DonutChart data={healthData} colors={healthColors} />
          )}
        </Panel>
      </div>

      {/* Delivery health */}
      <Panel title="Delivery health" description="Average completion across all active projects">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-5xl font-bold tabular-nums leading-none">{stats.avgProgress}%</p>
            <p className="mt-2 text-sm text-muted-foreground">Average project progress</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderKanban className="size-4 text-brand" />
            <span>{stats.counts.activeProjects} active / {stats.counts.projects} total</span>
          </div>
        </div>
        <Progress value={stats.avgProgress} className="mt-4 h-3" indicatorClassName="bg-brand" />
      </Panel>

      {/* Finance mini-summary (admin/finance only) */}
      {stats.finance && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard index={0} label="Revenue" value={formatCurrency(stats.finance.revenue)} icon={DollarSign} accent="hsl(var(--success))" hint="Paid invoices" />
          <KpiCard index={1} label="Outstanding" value={formatCurrency(stats.finance.outstanding)} icon={Receipt} accent="hsl(var(--warning))" hint="Sent + overdue" />
          <KpiCard index={2} label="Expenses" value={formatCurrency(stats.finance.expenses)} icon={Wallet} accent={accent} hint="Total spend" />
          <KpiCard index={3} label="Profit" value={formatCurrency(stats.finance.profit)} icon={TrendingUp} accent={stats.finance.profit >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} hint="Revenue − expenses" />
        </div>
      )}
    </div>
  );
}
