import { cn, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import type { RequestStatus } from "@/lib/api";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_COLORS[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
