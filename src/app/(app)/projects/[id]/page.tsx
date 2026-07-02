"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel } from "@/components/shared/section";
import {
  ProjectStatusBadge, PriorityBadge, TaskStatusBadge,
} from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadialProgress } from "@/components/charts/charts";
import { PROJECT_STAGES } from "@/lib/types";
import type { Project, Task, Client } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  FolderKanban, ArrowLeft, Pencil, Gauge, DollarSign, CheckSquare,
  CalendarDays, ListTodo, CheckCircle2, Circle, Clock, type LucideIcon,
} from "lucide-react";

function StatCard({
  label, value, icon: Icon, accent, children,
}: {
  label: string;
  value?: string;
  icon: LucideIcon;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-premium">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {value && <p className="mt-0.5 truncate text-lg font-bold tabular-nums">{value}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const { caps } = useSession();
  const { byId } = useTeam();

  const tasksRes = useResource<Task>("/api/r/tasks");
  const clientsRes = useResource<Client>("/api/r/clients");

  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    let active = true;
    fetch(`/api/r/projects/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (active) setProject(json.data ?? null);
      })
      .catch(() => {
        if (active) setProject(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <Link
          href="/projects"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="This project doesn't exist or may have been removed."
          action={
            <Button asChild variant="outline">
              <Link href="/projects">Back to Projects</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const clientName = clientsRes.data.find((c) => c.id === project.clientId)?.name ?? "—";
  const lead = byId(project.lead);
  const projectTasks = tasksRes.data.filter((t) => t.projectId === project.id);
  const tasksDone = projectTasks.filter((t) => t.status === "done").length;
  const isCompleted = project.status === "completed";
  // Progress is derived from tasks (done ÷ total), not a stored/manual value.
  // A completed project is always 100%, regardless of its tasks.
  const derivedProgress = isCompleted
    ? 100
    : projectTasks.length ? Math.round((tasksDone / projectTasks.length) * 100) : 0;

  const stageIndex = PROJECT_STAGES.findIndex((s) => s.id === project.status);
  const accent = "hsl(var(--brand))";

  const daysRemaining = project.deadline
    ? Math.round((new Date(project.deadline).getTime() - now) / 86_400_000)
    : null;

  return (
    <div>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Projects
      </Link>

      {/* Header band */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-premium"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full opacity-20 blur-3xl"
          style={{ background: accent }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{clientName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/projects">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {caps.manageProjects && (
              <Button asChild>
                <Link href={`/projects?edit=${project.id}`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Progress" icon={Gauge} accent={accent}>
          <div className="mt-2 flex items-center justify-center">
            <RadialProgress value={derivedProgress} label="Complete" size={120} color={accent} />
          </div>
        </StatCard>

        <StatCard
          label="Budget"
          icon={DollarSign}
          accent={accent}
          value={formatCurrency(project.budget, { compact: true })}
        >
          <p className="mt-3 text-xs text-muted-foreground">Total allocated budget</p>
        </StatCard>

        <StatCard
          label="Tasks"
          icon={CheckSquare}
          accent={accent}
          value={`${tasksDone}/${projectTasks.length}`}
        >
          <Progress
            value={projectTasks.length ? Math.round((tasksDone / projectTasks.length) * 100) : 0}
            className="mt-3 h-2"
            indicatorClassName="bg-brand"
          />
        </StatCard>

        <StatCard
          label="Deadline"
          icon={CalendarDays}
          accent={accent}
          value={project.deadline ? formatDate(project.deadline) : "—"}
        >
          {isCompleted ? (
            <p className="mt-2 text-xs font-medium text-success">Completed</p>
          ) : daysRemaining !== null && (
            <p className={cn(
              "mt-2 text-xs font-medium tabular-nums",
              daysRemaining < 0 ? "text-destructive" : daysRemaining <= 14 ? "text-warning" : "text-muted-foreground"
            )}>
              {daysRemaining < 0
                ? `${Math.abs(daysRemaining)} days overdue`
                : `${daysRemaining} days remaining`}
            </p>
          )}
        </StatCard>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({projectTasks.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel title="About">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {project.description || "No description provided."}
                </p>
              </Panel>

              <Panel title="Milestones" description="Delivery stages and their status">
                <ol className="relative space-y-5 pl-2">
                  <span className="absolute left-[18px] bottom-2 top-2 w-px bg-border" aria-hidden />
                  {PROJECT_STAGES.map((s, i) => {
                    // A finished project marks the whole delivery pipeline complete
                    // (the "Completed" stage included); "On Hold" is not part of it.
                    const isCompleted = project.status === "completed";
                    const done = isCompleted ? s.id !== "on_hold" : i < stageIndex;
                    const current = !isCompleted && i === stageIndex;
                    return (
                      <li key={s.id} className="relative flex items-center gap-4">
                        <div className={cn(
                          "z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-card",
                          done ? "border-success text-success" : current ? "border-brand text-brand" : "border-border text-muted-foreground"
                        )}>
                          {done ? <CheckCircle2 className="size-4" />
                            : current ? <Clock className="size-4" />
                            : <Circle className="size-4" />}
                        </div>
                        <div className="flex flex-1 items-center justify-between">
                          <span className={cn("font-medium", !done && !current && "text-muted-foreground")}>
                            {s.label}
                          </span>
                          {done && <Badge variant="success">Complete</Badge>}
                          {current && <Badge className="bg-brand text-brand-foreground">In Progress</Badge>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel title="Team" description={`${project.team.length} members`}>
                <div className="space-y-3">
                  {lead && (
                    <div className="flex items-center gap-3 rounded-xl bg-brand/10 p-2.5">
                      <UserAvatar name={lead.name} src={lead.avatar} className="size-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">{lead.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{lead.title}</p>
                      </div>
                      <Badge className="bg-brand text-brand-foreground text-[10px]">Lead</Badge>
                    </div>
                  )}
                  {project.team
                    .filter((mid) => mid !== project.lead)
                    .map((mid) => {
                      const m = byId(mid);
                      if (!m) return null;
                      return (
                        <div key={mid} className="flex items-center gap-3 px-1">
                          <UserAvatar name={m.name} src={m.avatar} className="size-8" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-tight">{m.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.title}</p>
                          </div>
                        </div>
                      );
                    })}
                  {project.team.length === 0 && !lead && (
                    <p className="text-sm text-muted-foreground">No team members assigned.</p>
                  )}
                </div>
              </Panel>

              <Panel title="Timeline">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Started</span>
                  <span className="font-medium tabular-nums">
                    {project.startDate ? formatDate(project.startDate) : "—"}
                  </span>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="font-medium tabular-nums">
                    {project.deadline ? formatDate(project.deadline) : "—"}
                  </span>
                </div>
              </Panel>
            </div>
          </div>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-5">
          {tasksRes.loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : projectTasks.length === 0 ? (
            <EmptyState icon={ListTodo} title="No tasks" description="This project has no tasks yet." />
          ) : (
            <div className="space-y-2.5">
              {projectTasks.map((t) => {
                const m = byId(t.assignee);
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-premium"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                    <TaskStatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    {t.dueDate && (
                      <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {formatDate(t.dueDate, { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {m && (
                      <span className="inline-flex items-center gap-2">
                        <UserAvatar name={m.name} src={m.avatar} className="size-6" />
                        <span className="text-xs text-muted-foreground">{m.name}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
