"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/components/providers/session-provider";
import { useAppConfig, titleCaseRole, parseRoleLabels } from "@/components/providers/config-provider";
import {
  LEAD_STAGES, PROJECT_STAGES, TASK_STATUSES, PRIORITIES,
  CONTENT_TYPES, CONTENT_STATUSES, ROLES, ROLE_LABELS, type Role,
} from "@/lib/types";
import { NAV_ITEMS, pagesForRole } from "@/lib/rbac";
import { Plus, X, Lock, Pencil, Check } from "lucide-react";

type Config = Record<string, string[]>;

const GROUPS: { key: string; label: string; desc: string }[] = [
  { key: "leadServices", label: "Service types", desc: "Services a lead can be interested in." },
  { key: "leadSources", label: "Lead sources", desc: "Where your leads come from." },
  { key: "expenseCategories", label: "Expense categories", desc: "Buckets for finance expenses." },
  { key: "departments", label: "Departments", desc: "Team departments." },
  { key: "industries", label: "Client industries", desc: "Industry tags for clients." },
];

const PRIORITY_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export default function ConfigPage() {
  const { caps } = useSession();
  const appConfig = useAppConfig();
  const editable = caps.manageSettings;
  const [config, setConfig] = React.useState<Config | null>(null);
  const [inputs, setInputs] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j) => setConfig(j.data ?? {}))
      .catch(() => setConfig({}));
  }, []);

  function persist(key: string, values: string[]) {
    setConfig((c) => ({ ...(c ?? {}), [key]: values }));
    void fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, values }),
    })
      // Keep the live sidebar / command palette in sync with edited access.
      .then(() => appConfig.refresh())
      .catch(() => {});
  }

  function addValue(key: string) {
    const v = (inputs[key] ?? "").trim();
    if (!v) return;
    const current = config?.[key] ?? [];
    if (current.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setInputs((s) => ({ ...s, [key]: "" }));
      return;
    }
    persist(key, [...current, v]);
    setInputs((s) => ({ ...s, [key]: "" }));
  }

  function removeValue(key: string, value: string) {
    persist(key, (config?.[key] ?? []).filter((x) => x !== value));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Config"
        description="Customize the option lists used across the app — add, rename or remove your own types."
      />

      {!editable && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" /> Only admins can edit configuration. You can view the current values.
        </div>
      )}

      {!config ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GROUPS.map((g) => {
            const values = config[g.key] ?? [];
            return (
              <div key={g.key} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-tight">{g.label}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">{values.length}</span>
                </div>
                <p className="mb-4 text-[13px] text-muted-foreground">{g.desc}</p>

                <div className="flex flex-wrap gap-2">
                  {values.length === 0 && <p className="text-sm text-muted-foreground">No options yet.</p>}
                  {values.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 py-1 pl-2.5 pr-1.5 text-[13px]"
                    >
                      {v}
                      {editable && (
                        <button
                          onClick={() => removeValue(g.key, v)}
                          aria-label={`Remove ${v}`}
                          className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {editable && (
                  <div className="mt-4 flex items-center gap-2">
                    <Input
                      value={inputs[g.key] ?? ""}
                      onChange={(e) => setInputs((s) => ({ ...s, [g.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addValue(g.key); } }}
                      placeholder={`Add a ${g.label.toLowerCase().replace(/s$/, "")}…`}
                      className="h-9"
                    />
                    <Button onClick={() => addValue(g.key)} className="shrink-0 gap-1.5">
                      <Plus className="size-4" /> Add
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Roles + per-role page access */}
      {config && (
        <RolesAndAccess
          config={config}
          editable={editable}
          input={inputs.__role ?? ""}
          setInput={(v) => setInputs((s) => ({ ...s, __role: v }))}
          persist={persist}
        />
      )}

      {/* Read-only structural types (drive boards & logic) */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Pipeline & workflow types</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          These drive the boards and reporting, so they&apos;re managed by the system.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Reference title="Lead stages" items={LEAD_STAGES.map((s) => ({ label: s.label, color: s.color }))} />
          <Reference title="Project statuses" items={PROJECT_STAGES.map((s) => ({ label: s.label, color: s.color }))} />
          <Reference title="Task statuses" items={TASK_STATUSES.map((s) => ({ label: s.label, color: s.color }))} />
          <Reference title="Priorities" items={PRIORITIES.map((p) => ({ label: PRIORITY_LABEL[p] }))} />
          <Reference title="Content types" items={CONTENT_TYPES.map((t) => ({ label: t.label, color: t.color }))} />
          <Reference title="Content statuses" items={CONTENT_STATUSES.map((s) => ({ label: s.label, color: s.color }))} />
        </div>
      </div>
    </div>
  );
}

function RolesAndAccess({
  config,
  editable,
  input,
  setInput,
  persist,
}: {
  config: Config;
  editable: boolean;
  input: string;
  setInput: (v: string) => void;
  persist: (key: string, values: string[]) => void;
}) {
  const customRoles = (config.roles ?? []).filter((r) => !ROLES.includes(r as Role));
  const removedBuiltins = (config.removedRoles ?? []).filter((r) => ROLES.includes(r as Role) && r !== "admin");
  const activeBuiltins = ROLES.filter((r) => !removedBuiltins.includes(r));
  const allRoles: string[] = [...activeBuiltins, ...customRoles];

  const labelOverrides = parseRoleLabels(config.roleLabels);
  const [editingRole, setEditingRole] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");

  function isBuiltin(role: string) {
    return ROLES.includes(role as Role);
  }
  function roleLabel(role: string) {
    return labelOverrides[role] ?? ROLE_LABELS[role as Role] ?? titleCaseRole(role);
  }
  function pagesOf(role: string) {
    return pagesForRole(role, config[`pages:${role}`]);
  }

  function addRole() {
    const slug = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) return;
    if ([...ROLES, ...customRoles].includes(slug)) { setInput(""); return; }
    // If re-adding a previously removed built-in, just restore it.
    if (removedBuiltins.includes(slug)) { restoreRole(slug); setInput(""); return; }
    persist("roles", [...customRoles, slug]);
    setInput("");
  }
  function deleteRole(role: string) {
    if (role === "admin") return; // never removable
    if (isBuiltin(role)) persist("removedRoles", [...removedBuiltins, role]);
    else persist("roles", customRoles.filter((r) => r !== role));
  }
  function restoreRole(role: string) {
    persist("removedRoles", removedBuiltins.filter((r) => r !== role));
  }

  function startRename(role: string) {
    setEditingRole(role);
    setEditValue(roleLabel(role));
  }
  function saveRename() {
    if (!editingRole) return;
    const role = editingRole;
    const label = editValue.trim();
    const next = { ...labelOverrides };
    // Empty or unchanged-from-default → drop the override.
    const builtinLabel = ROLE_LABELS[role as Role] ?? titleCaseRole(role);
    if (!label || label === builtinLabel) delete next[role];
    else next[role] = label;
    persist("roleLabels", Object.entries(next).map(([s, l]) => `${s}=${l}`));
    setEditingRole(null);
    setEditValue("");
  }
  function togglePage(role: string, key: string) {
    const current = pagesOf(role);
    const next = current.includes(key as never)
      ? current.filter((k) => k !== key)
      : [...current, key];
    persist(`pages:${role}`, next as string[]);
  }

  return (
    <div className="space-y-4">
      {/* Roles */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Roles</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{allRoles.length}</span>
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Rename, delete or add roles. The Admin role is protected so you can&apos;t lock yourself out.
        </p>
        <div className="flex flex-wrap gap-2">
          {allRoles.map((r) => {
            const protectedRole = r === "admin";
            if (editable && editingRole === r) {
              return (
                <span key={r} className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/50 py-0.5 pl-1.5 pr-1 text-[13px]">
                  <Input
                    value={editValue}
                    autoFocus
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); saveRename(); }
                      if (e.key === "Escape") { setEditingRole(null); }
                    }}
                    className="h-7 w-32"
                  />
                  <button
                    onClick={saveRename}
                    aria-label="Save name"
                    className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-success/15 hover:text-success"
                  >
                    <Check className="size-3.5" />
                  </button>
                </span>
              );
            }
            return (
              <span
                key={r}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 py-1 pl-2.5 pr-1.5 text-[13px]"
              >
                {protectedRole && <Lock className="size-3 text-muted-foreground" />}
                {roleLabel(r)}
                {editable && (
                  <>
                    <button
                      onClick={() => startRename(r)}
                      aria-label={`Rename ${roleLabel(r)}`}
                      className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                    {!protectedRole && (
                      <button
                        onClick={() => deleteRole(r)}
                        aria-label={`Delete ${roleLabel(r)}`}
                        className="flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </>
                )}
              </span>
            );
          })}
        </div>

        {/* Removed built-in roles — restore them anytime. */}
        {editable && removedBuiltins.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">Removed</span>
            {removedBuiltins.map((r) => (
              <button
                key={r}
                onClick={() => restoreRole(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border py-1 pl-2.5 pr-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {roleLabel(r)}
                <Plus className="size-3" /> Restore
              </button>
            ))}
          </div>
        )}

        {editable && (
          <div className="mt-4 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }}
              placeholder="Add a role…"
              className="h-9"
            />
            <Button onClick={addRole} className="shrink-0 gap-1.5">
              <Plus className="size-4" /> Add
            </Button>
          </div>
        )}
      </div>

      {/* Page access matrix */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Page access</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Choose which pages each role can see in the sidebar. Changes apply on next page load for affected users.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Role
                </th>
                {NAV_ITEMS.map((item) => (
                  <th key={item.key} className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground">
                    <span className="flex flex-col items-center gap-1">
                      <item.icon className="size-4" />
                      <span className="max-w-16 truncate">{item.label}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRoles.map((role) => {
                const pages = pagesOf(role);
                return (
                  <tr key={role} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card px-2 py-2 font-medium whitespace-nowrap">
                      {roleLabel(role)}
                    </td>
                    {NAV_ITEMS.map((item) => {
                      const on = pages.includes(item.key);
                      // Admin keeps full access — locking dashboard/settings/config avoids lockouts.
                      const locked = role === "admin";
                      return (
                        <td key={item.key} className="px-2 py-2 text-center">
                          <Checkbox
                            checked={on}
                            disabled={!editable || locked}
                            onCheckedChange={() => togglePage(role, item.key)}
                            aria-label={`${roleLabel(role)} can see ${item.label}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Reference({ title, items }: { title: string; items: { label: string; color?: string }[] }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-[13px]">
            <span className="size-2 rounded-full" style={{ background: it.color ?? "hsl(var(--muted-foreground))" }} />
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
