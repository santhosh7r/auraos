import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/60 animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
