import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, Send, RotateCcw, Shield, CheckCircle } from "lucide-react";
import { useDataStore, type Plan } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

interface PlanExt extends Plan {
  routeDescription?: string;
  riskLevel?: "low" | "medium" | "high";
  dangerousGoods?: boolean;
}

type PlanStatus = Plan["status"];

const ROLE_CAPTAIN = "captain";
const ROLE_DUTY = "duty_officer";
const ROLE_SUPERVISOR = "supervisor";

const riskLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const riskColors: Record<string, string> = {
  low: "text-port",
  medium: "text-warning",
  high: "text-danger",
};

const tabs: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "submitted", label: "待审核" },
  { key: "reviewing", label: "审核中" },
  { key: "inspecting", label: "抽查中" },
  { key: "released", label: "已放行" },
  { key: "rejected", label: "已打回" },
  { key: "revoked", label: "已撤销" },
];

function getActions(
  role: string,
  status: PlanStatus
): { label: string; icon: React.ElementType; variant: string }[] {
  const actions: { label: string; icon: React.ElementType; variant: string }[] = [];

  if (role === ROLE_CAPTAIN) {
    if (status === "draft") {
      actions.push({ label: "提交", icon: Send, variant: "primary" });
    }
    if (status === "submitted") {
      actions.push({ label: "撤回", icon: RotateCcw, variant: "warning" });
    }
  }

  if (role === ROLE_DUTY) {
    if (status === "submitted" || status === "reviewing") {
      actions.push({ label: "审核", icon: Shield, variant: "primary" });
    }
    if (status === "inspecting" || status === "reviewing") {
      actions.push({ label: "放行", icon: CheckCircle, variant: "success" });
    }
  }

  if (role === ROLE_SUPERVISOR) {
    if (status === "reviewing") {
      actions.push({ label: "抽查", icon: Shield, variant: "primary" });
    }
  }

  actions.push({ label: "查看", icon: Eye, variant: "default" });
  return actions;
}

const variantStyles: Record<string, string> = {
  primary: "bg-nautical/20 text-nautical-light hover:bg-nautical/30",
  warning: "bg-warning/20 text-warning hover:bg-warning/30",
  success: "bg-port/20 text-port hover:bg-port/30",
  default: "bg-navy-lighter/50 text-gray-400 hover:bg-navy-lighter",
};

export default function PlanList() {
  const { plans, ships, fetchPlans, fetchShips } = useDataStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchPlans();
    fetchShips();
  }, [fetchPlans, fetchShips]);

  const getShipName = (shipId: string) => ships.find((s) => s.id === shipId)?.name ?? "-";

  const filtered =
    activeTab === "all"
      ? plans
      : plans.filter((p) => p.status === activeTab);

  const extPlans = filtered as PlanExt[];

  const handleAction = (plan: Plan, actionLabel: string) => {
    if (actionLabel === "查看") {
      navigate(`/plans/${plan.id}`);
      return;
    }
    navigate(`/plans/${plan.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">
              出港计划列表
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              管理所有出港计划与审批流程
            </p>
          </div>
          {user?.role === ROLE_CAPTAIN && (
            <button
              onClick={() => navigate("/plans/new")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-nautical text-white text-sm hover:bg-nautical-light transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建计划
            </button>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                activeTab === tab.key
                  ? "bg-nautical text-white"
                  : "bg-navy-lighter/50 text-gray-400 hover:bg-navy-lighter hover:text-gray-300"
              )}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1 opacity-60">
                  {plans.filter((p) => p.status === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="bg-navy-light border border-navy-lighter rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-navy-lighter bg-navy-lighter/30">
                  <th className="text-left py-3 px-4 font-medium">计划编号</th>
                  <th className="text-left py-3 px-4 font-medium">船舶</th>
                  <th className="text-left py-3 px-4 font-medium">航线</th>
                  <th className="text-left py-3 px-4 font-medium">风险等级</th>
                  <th className="text-left py-3 px-4 font-medium">危险品</th>
                  <th className="text-left py-3 px-4 font-medium">状态</th>
                  <th className="text-left py-3 px-4 font-medium">计划出港</th>
                  <th className="text-right py-3 px-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {extPlans.length > 0 ? (
                  extPlans.map((plan) => {
                    const actions = getActions(user?.role ?? "", plan.status);
                    return (
                      <tr
                        key={plan.id}
                        className="border-b border-navy-lighter/50 hover:bg-navy-lighter/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`/plans/${plan.id}`)}
                      >
                        <td className="py-3 px-4 text-gray-300 font-mono text-xs">
                          {plan.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4 text-gray-200">
                          {getShipName(plan.ship_id)}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          {plan.route}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              riskColors[plan.route_risk_level ?? "low"]
                            )}
                          >
                            {riskLabels[plan.route_risk_level ?? "low"]}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {plan.danger_goods_declared ? (
                            <span className="text-xs text-danger">是</span>
                          ) : (
                            <span className="text-xs text-gray-500">否</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={plan.status as never} />
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          {plan.departure_time}
                        </td>
                        <td className="py-3 px-4">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {actions.map((action) => (
                              <button
                                key={action.label}
                                onClick={() =>
                                  handleAction(plan, action.label)
                                }
                                className={cn(
                                  "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                                  variantStyles[action.variant]
                                )}
                              >
                                <action.icon className="w-3 h-3" />
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-gray-500"
                    >
                      暂无计划数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
