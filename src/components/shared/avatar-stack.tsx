"use client";

import { UserAvatar } from "@/components/ui/avatar";
import { useTeam } from "@/components/providers/team-provider";
import { cn } from "@/lib/utils";

export function AvatarStack({
  ids,
  max = 4,
  size = "size-7",
  mono = true,
}: {
  ids: string[];
  max?: number;
  size?: string;
  mono?: boolean;
}) {
  const { byId } = useTeam();
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((id) => {
        const m = byId(id);
        return (
          <UserAvatar
            key={id}
            mono={mono}
            name={m?.name ?? "?"}
            src={m?.avatar}
            className={cn(size, "text-[10px] ring-2 ring-card")}
          />
        );
      })}
      {extra > 0 && (
        <span
          className={cn(
            size,
            "flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card"
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
