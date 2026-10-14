import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Compact empty state for dashboard widgets: one line of copy + a link CTA. */
export function WidgetEmpty({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
