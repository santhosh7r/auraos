"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession } from "@/components/providers/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  User, Palette, Building2, ShieldCheck, ShieldAlert,
  Sun, Moon, Monitor, ArrowRight, type LucideIcon,
} from "lucide-react";

const THEME_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access — manages team, settings, finance and all records.",
  manager: "Runs delivery — manages projects, tasks and the team roster.",
  sales: "Owns the pipeline — manages leads and client relationships.",
  developer: "Builds the work — sees assigned projects and tasks.",
  designer: "Designs the work — sees assigned projects and tasks.",
  marketing: "Drives demand — manages leads and marketing tasks.",
  finance: "Handles money — manages invoices and finance reports.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, appearance and workspace." />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="size-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="size-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <Building2 className="size-4" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="access">
            <ShieldCheck className="size-4" /> Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
        <TabsContent value="access">
          <AccessTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { user } = useSession();
  return (
    <Panel title="Your profile" description="How you appear across the workspace.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar name={user.name} src={user.avatar} className="size-16" />
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            {user.title && <Badge variant="outline">{user.title}</Badge>}
          </div>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadField label="Full name" value={user.name} />
        <ReadField label="Email" value={user.email} />
        <ReadField label="Role" value={ROLE_LABELS[user.role]} />
        <ReadField label="Job title" value={user.title || "—"} />
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Contact an admin to change your role.
      </p>
    </Panel>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = mounted ? theme ?? "system" : undefined;

  return (
    <Panel title="Appearance" description="Choose how Aura looks on this device.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-5 text-sm font-medium transition-colors",
                active
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border bg-card text-muted-foreground hover:border-[hsl(0_0%_23%)]"
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  active ? "bg-brand text-brand-foreground" : "bg-muted"
                )}
              >
                <Icon className="size-5" />
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>

      <Separator className="my-5" />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Current theme</span>
        <span className="font-medium capitalize">{current ?? "—"}</span>
      </div>
    </Panel>
  );
}

function WorkspaceTab() {
  return (
    <Panel title="Workspace" description="Company-wide settings managed by admins.">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Building2 className="size-6" />
        </div>
        <div>
          <p className="text-base font-semibold leading-tight">Aura HQ</p>
          <p className="text-sm text-muted-foreground">Your workspace</p>
        </div>
      </div>
    </Panel>
  );
}

function AccessTab() {
  const { caps } = useSession();

  if (!caps.manageSettings) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Restricted — admin only"
        description="Access and role management is available to administrators."
      />
    );
  }

  return (
    <Panel
      title="Roles & access"
      description="What each role can do in the workspace."
      action={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/team">
            Manage team <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <ul className="divide-y divide-border">
        {ROLES.map((role) => (
          <li key={role} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <Badge variant="secondary" className="mt-0.5 shrink-0">
              {ROLE_LABELS[role]}
            </Badge>
            <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <div className="flex h-9 items-center rounded-xl border border-border bg-muted/30 px-3 text-sm">
        {value}
      </div>
    </div>
  );
}
