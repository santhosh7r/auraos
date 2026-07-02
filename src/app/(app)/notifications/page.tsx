"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { AppNotification, NotificationType } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import {
  Bell, CheckCheck, CheckSquare, FolderKanban, Contact2, Building2,
  Receipt, Settings, CircleCheck, type LucideIcon,
} from "lucide-react";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  task: CheckSquare,
  project: FolderKanban,
  lead: Contact2,
  client: Building2,
  invoice: Receipt,
  system: Settings,
};

export default function NotificationsPage() {
  const router = useRouter();
  const { data, loading, update } = useResource<AppNotification>("/api/r/notifications");

  const sorted = React.useMemo(
    () =>
      [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [data]
  );
  const unread = sorted.filter((n) => !n.read);

  const [markingAll, setMarkingAll] = React.useState(false);

  async function markAllRead() {
    if (unread.length === 0) return;
    setMarkingAll(true);
    await Promise.all(unread.map((n) => update(n.id, { read: true })));
    setMarkingAll(false);
  }

  function markRead(id: string) {
    void update(id, { read: true });
  }

  function openNotification(n: AppNotification) {
    if (!n.read) void update(n.id, { read: true });
    if (n.href) router.push(n.href);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Activity across your workspace.">
        <Button
          variant="outline"
          onClick={markAllRead}
          disabled={markingAll || unread.length === 0}
          className="gap-2"
        >
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </PageHeader>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread" className="gap-1.5">
            Unread
            {unread.length > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold tabular-nums text-brand-foreground">
                {unread.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <NotificationList
            items={sorted}
            loading={loading}
            onOpen={openNotification}
            onMarkRead={markRead}
            emptyTitle="You're all caught up"
            emptyDescription="New activity will show up here as it happens."
          />
        </TabsContent>

        <TabsContent value="unread">
          <NotificationList
            items={unread}
            loading={loading}
            onOpen={openNotification}
            onMarkRead={markRead}
            emptyTitle="You're all caught up"
            emptyDescription="No unread notifications right now."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationList({
  items,
  loading,
  onOpen,
  onMarkRead,
  emptyTitle,
  emptyDescription,
}: {
  items: AppNotification[];
  loading: boolean;
  onOpen: (n: AppNotification) => void;
  onMarkRead: (id: string) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={CircleCheck} title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((n, i) => {
        const Icon = TYPE_ICON[n.type];
        return (
          <motion.li
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.025 }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(n);
                }
              }}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[hsl(0_0%_23%)]",
                !n.read && "border-l-4 border-l-brand"
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  n.read ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand"
                )}
              >
                <Icon className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("truncate text-sm", !n.read && "font-semibold")}>
                    {n.title}
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                {n.body && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {n.body}
                  </p>
                )}
                {!n.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-7 px-2 text-xs text-brand hover:text-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(n.id);
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
