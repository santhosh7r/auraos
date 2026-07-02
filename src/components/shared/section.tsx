import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      {(title || action) && (
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent className={cn("flex-1 pt-3", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}
