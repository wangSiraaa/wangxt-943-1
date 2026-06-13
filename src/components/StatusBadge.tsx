import { cn } from "@/lib/utils";

type PlanStatus =
  | "draft"
  | "submitted"
  | "reviewing"
  | "inspecting"
  | "released"
  | "rejected"
  | "revoked"
  | "withdrawn";

type VoyageStatus = "active" | "returning" | "abnormal_return" | "closed";

type BadgeStatus = PlanStatus | VoyageStatus;

const planStatusLabels: Record<PlanStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  reviewing: "审核中",
  inspecting: "检查中",
  released: "已放行",
  rejected: "已驳回",
  revoked: "已撤销",
  withdrawn: "已撤回",
};

const voyageStatusLabels: Record<VoyageStatus, string> = {
  active: "出海中",
  returning: "返航中",
  abnormal_return: "异常返航",
  closed: "已归港",
};

const statusColors: Record<BadgeStatus, string> = {
  draft: "bg-gray-600/30 text-gray-400",
  submitted: "bg-blue-600/30 text-blue-400",
  reviewing: "bg-yellow-600/30 text-yellow-400",
  inspecting: "bg-orange-600/30 text-orange-400",
  released: "bg-green-600/30 text-green-400",
  rejected: "bg-red-600/30 text-red-400",
  revoked: "bg-purple-600/30 text-purple-400",
  withdrawn: "bg-gray-600/30 text-gray-400",
  active: "bg-blue-600/30 text-blue-400",
  returning: "bg-yellow-600/30 text-yellow-400",
  abnormal_return: "bg-orange-600/30 text-orange-400",
  closed: "bg-green-600/30 text-green-400",
};

function getStatusLabel(status: BadgeStatus): string {
  if (status in planStatusLabels) return planStatusLabels[status as PlanStatus];
  return voyageStatusLabels[status as VoyageStatus];
}

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        statusColors[status],
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
