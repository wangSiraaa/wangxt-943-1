import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  RotateCcw,
  Shield,
  CheckCircle,
  XCircle,
  Ban,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Edit3,
} from "lucide-react";
import { useDataStore, type Plan } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/StatusBadge";
import Timeline, { type TimelineNode } from "@/components/Timeline";
import { cn } from "@/lib/utils";

const ROLE_CAPTAIN = "captain";
const ROLE_DUTY = "duty_officer";
const ROLE_SUPERVISOR = "supervisor";

interface PlanExt extends Plan {
  berthNumber?: string;
  crewNames?: string[];
}

interface ApprovalRecord {
  id: string;
  action: string;
  operatorName: string;
  operatorRole: string;
  comment?: string;
  time: string;
  status: "completed" | "current" | "pending";
}

interface RiskChangeLog {
  id: string;
  oldRiskLevel: string;
  newRiskLevel: string;
  changeReason: string;
  changedByName: string;
  createdAt: string;
}

const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const riskColors: Record<string, string> = {
  low: "text-port",
  medium: "text-warning",
  high: "text-danger",
};

const variantBtn: Record<string, string> = {
  primary: "bg-nautical/20 text-nautical-light hover:bg-nautical/30",
  success: "bg-port/20 text-port hover:bg-port/30",
  warning: "bg-warning/20 text-warning hover:bg-warning/30",
  danger: "bg-danger/20 text-danger-light hover:bg-danger/30",
};

interface ActionButton {
  label: string;
  icon: React.ElementType;
  variant: string;
  onClick: () => void;
}

async function apiPost<T>(url: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "操作失败");
  }
  return res.json();
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { plans, ships, crew, fetchPlans, fetchShips, fetchCrew } = useDataStore();

  const [plan, setPlan] = useState<PlanExt | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [riskLogs, setRiskLogs] = useState<RiskChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRiskChangeModal, setShowRiskChangeModal] = useState(false);
  const [newRiskLevel, setNewRiskLevel] = useState("");
  const [riskChangeReason, setRiskChangeReason] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [planRes, recRes, riskRes] = await Promise.all([
        fetch(`/api/plans/${id}`).then((r) => r.json()),
        fetch(`/api/plans/${id}/approval-records`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
        fetch(`/api/plans/${id}/risk-change-logs`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
      ]);
      setPlan(planRes.success ? planRes.data : planRes);
      setRecords(recRes.success ? recRes.data : recRes);
      setRiskLogs(riskRes.success ? riskRes.data : riskRes);
    } catch {
      setError("加载计划详情失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    fetchShips();
    fetchCrew();
  }, [fetchDetail, fetchShips, fetchCrew]);

  const getShipName = (shipId: string) => ships.find((s) => s.id === shipId)?.name ?? "-";
  const getCrewNames = (crewIds?: string[]) => {
    if (!crewIds) return [];
    return crewIds.map((cid) => crew.find((c) => c.id === cid)?.name).filter(Boolean) as string[];
  };
  const getBerthName = (berthId: string | null) => {
    if (!berthId) return null;
    return `泊位 ${berthId.slice(0, 8)}`;
  };

  const handleAction = async (action: string, body?: object) => {
    if (!id) return;
    setActionLoading(true);
    setError("");
    try {
      await apiPost(`/api/plans/${id}/${action}`, body);
      await fetchDetail();
      fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
      setComment("");
    }
  };

  const handleRiskChange = async () => {
    if (!id || !newRiskLevel || !riskChangeReason) return;
    setActionLoading(true);
    setError("");
    try {
      await apiPost(`/api/plans/${id}/risk-change`, {
        newRiskLevel,
        changeReason: riskChangeReason,
      });
      await fetchDetail();
      fetchPlans();
      setShowRiskChangeModal(false);
      setNewRiskLevel("");
      setRiskChangeReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const role = user?.role ?? "";
  const status = plan?.status ?? "";
  const isLowRisk = plan?.route_risk_level === "low";

  const actionButtons: ActionButton[] = useMemo(() => {
    const btns: ActionButton[] = [];

    if (role === ROLE_CAPTAIN && status === "draft") {
      btns.push({
        label: "提交审批",
        icon: Send,
        variant: "primary",
        onClick: () => handleAction("submit"),
      });
    }

    if (role === ROLE_CAPTAIN && status === "submitted") {
      btns.push({
        label: "撤回计划",
        icon: RotateCcw,
        variant: "warning",
        onClick: () => handleAction("withdraw"),
      });
    }

    if (
      role === ROLE_DUTY &&
      (status === "submitted" || status === "reviewing")
    ) {
      btns.push(
        {
          label: "审核通过",
          icon: CheckCircle,
          variant: "success",
          onClick: () => handleAction("review", { approve: true, comment }),
        },
        {
          label: "审核驳回",
          icon: XCircle,
          variant: "danger",
          onClick: () => handleAction("review", { approve: false, comment }),
        }
      );
    }

    if (
      role === ROLE_SUPERVISOR &&
      (status === "reviewing" || status === "inspecting")
    ) {
      btns.push(
        {
          label: "抽查通过",
          icon: Shield,
          variant: "success",
          onClick: () => handleAction("inspect", { approve: true, comment }),
        },
        {
          label: "抽查驳回",
          icon: XCircle,
          variant: "danger",
          onClick: () => handleAction("inspect", { approve: false, comment }),
        }
      );
    }

    if (
      role === ROLE_DUTY &&
      (status === "inspecting" || (status === "reviewing" && isLowRisk))
    ) {
      btns.push({
        label: "放行",
        icon: CheckCircle,
        variant: "success",
        onClick: () => handleAction("release"),
      });
    }

    if (
      (role === ROLE_SUPERVISOR || role === ROLE_DUTY) &&
      status === "released"
    ) {
      btns.push({
        label: "撤销放行",
        icon: Ban,
        variant: "danger",
        onClick: () => handleAction("revoke", { reason: comment }),
      });
    }

    if (
      role === ROLE_SUPERVISOR &&
      ["submitted", "reviewing", "inspecting"].includes(status)
    ) {
      btns.push({
        label: "变更风险等级",
        icon: TrendingUp,
        variant: "warning",
        onClick: () => setShowRiskChangeModal(true),
      });
    }

    return btns;
  }, [role, status, isLowRisk, comment, handleAction]);

  const needsComment =
    status === "submitted" ||
    status === "reviewing" ||
    status === "inspecting" ||
    (status === "released" && (role === ROLE_SUPERVISOR || role === ROLE_DUTY));

  const nodeLabels: Record<string, string> = {
    auto_check: "自动校验",
    duty_review: "值班复核",
    supervisor_inspect: "监管抽查",
    dock_release: "码头放行",
  };

  const actionLabels: Record<string, string> = {
    approved: "通过",
    rejected: "驳回",
    revoked: "撤销",
    pending: "待处理",
  };

  const timelineNodes: TimelineNode[] = records.map((r: any) => {
    const node = r.node || r.step || "unknown";
    const action = r.action || r.result || "unknown";
    const operatorName = r.operator_name || r.operatorName || r.operator || "系统";
    const operatorRole = r.operator_role || r.operatorRole || "";
    return {
      title: `${nodeLabels[node] || node} - ${actionLabels[action] || action}`,
      time: r.created_at || r.time,
      operator: operatorRole ? `${operatorName} (${operatorRole})` : operatorName,
      comment: r.comment,
      status:
        action === "approved"
          ? "completed"
          : action === "rejected" || action === "revoked"
          ? "completed"
          : action === "pending"
          ? "current"
          : "completed",
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-gray-400">计划不存在</p>
        <button
          onClick={() => navigate("/plans")}
          className="text-sm text-nautical-light hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/plans")}
            className="p-1.5 rounded-lg hover:bg-navy-lighter text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-100">
                计划详情
              </h1>
              <StatusBadge status={status as never} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              计划编号: {plan.id.slice(0, 8)}
            </p>
          </div>
          {plan.voyage_id && (
            <button
              onClick={() => navigate(`/voyages/${plan.voyage_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nautical/20 text-nautical-light text-xs hover:bg-nautical/30 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              查看航次
            </button>
          )}
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger-light rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 border-b border-navy-lighter pb-2 mb-4">
            基本信息
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1">
            <InfoItem label="船舶" value={getShipName(plan.ship_id)} />
            <InfoItem
              label="航线"
              value={plan.route}
            />
            <InfoItem label="计划出港" value={plan.departure_time} />
            <InfoItem label="预计返港" value={plan.expected_return_time} />
            <InfoItem
              label="航线风险"
              value={riskLabels[plan.route_risk_level ?? "low"]}
              valueClass={riskColors[plan.route_risk_level ?? "low"]}
            />
            <InfoItem
              label="危险品"
              value={plan.danger_goods_declared ? "是" : "否"}
              valueClass={plan.danger_goods_declared ? "text-danger" : "text-gray-400"}
            />
            {plan.danger_goods_declared && plan.danger_goods_detail && (
              <div className="col-span-2 py-2 flex flex-col gap-0.5">
                <span className="text-xs text-gray-500">危险品详情</span>
                <span className="text-sm text-gray-300 bg-navy-lighter/50 rounded px-2 py-1">
                  {plan.danger_goods_detail}
                </span>
              </div>
            )}
            <InfoItem
              label="燃油余量"
              value={`${plan.fuel_remaining}%`}
            />
            <InfoItem label="泊位" value={plan.berth_id ? getBerthName(plan.berth_id) : "-"} />
            <InfoItem label="船员人数" value={`${plan.crew_ids?.length ?? 0}人`} />
            {plan.crew_ids && plan.crew_ids.length > 0 && (
              <div className="col-span-2 py-2 flex flex-col gap-0.5">
                <span className="text-xs text-gray-500">随行船员</span>
                <span className="text-sm text-gray-300">
                  {getCrewNames(plan.crew_ids).join("、")}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 border-b border-navy-lighter pb-2 mb-4">
            审批流程
          </h3>
          {timelineNodes.length > 0 ? (
            <Timeline nodes={timelineNodes} />
          ) : (
            <p className="text-sm text-gray-500">暂无审批记录</p>
          )}
        </section>

        {riskLogs.length > 0 && (
          <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-200 border-b border-navy-lighter pb-2 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
              风险变更历史
            </h3>
            <div className="space-y-3">
              {riskLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-navy border border-navy-lighter rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded", riskColors[log.old_risk_level || "low"])}>
                        {riskLabels[log.old_risk_level || "low"]}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded", riskColors[log.new_risk_level])}>
                        {riskLabels[log.new_risk_level]}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {new Date(log.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className="text-gray-300">{log.changed_by_name || log.changedByName || "未知用户"}</span>
                    <span className="mx-1">•</span>
                    <span>变更原因: {log.change_reason || log.changeReason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 border-b border-navy-lighter pb-2 mb-4">
            操作
          </h3>
          {actionButtons.length > 0 ? (
            <div className="space-y-3">
              {needsComment && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    {status === "released" ? "撤销原因" : "审批意见"}
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder={
                      status === "released"
                        ? "请输入撤销原因..."
                        : "请输入审批意见（可选）..."
                    }
                    className="w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-nautical transition-colors resize-none"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {actionButtons.map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    disabled={actionLoading}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      variantBtn[btn.variant],
                      actionLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <btn.icon className="w-4 h-4" />
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">当前状态无可用操作</p>
          )}
        </section>
      </div>

      <RiskChangeModal
        show={showRiskChangeModal}
        onClose={() => {
          setShowRiskChangeModal(false);
          setNewRiskLevel("");
          setRiskChangeReason("");
        }}
        onConfirm={handleRiskChange}
        currentLevel={plan?.route_risk_level || "low"}
        newLevel={newRiskLevel}
        setNewLevel={setNewRiskLevel}
        reason={riskChangeReason}
        setReason={setRiskChangeReason}
        loading={actionLoading}
      />
    </div>
  );
}

function InfoItem({
  label,
  value,
  valueClass = "text-gray-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="py-2 flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn("text-sm", valueClass)}>{value}</span>
    </div>
  );
}

function RiskChangeModal({
  show,
  onClose,
  onConfirm,
  currentLevel,
  newLevel,
  setNewLevel,
  reason,
  setReason,
  loading,
}: {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentLevel: string;
  newLevel: string;
  setNewLevel: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  loading: boolean;
}) {
  if (!show) return null;

  const riskOptions = [
    { value: "low", label: "低风险", color: "text-success" },
    { value: "medium", label: "中风险", color: "text-warning" },
    { value: "high", label: "高风险", color: "text-danger" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-navy-light border border-navy-lighter rounded-xl w-full max-w-md">
        <div className="p-5 border-b border-navy-lighter">
          <h3 className="text-lg font-semibold text-gray-100">变更风险等级</h3>
          <p className="text-xs text-gray-500 mt-1">变更后将自动记录审计日志</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2">当前风险等级</label>
            <div className={cn("text-sm font-medium", riskColors[currentLevel || "low"])}>
              {riskLabels[currentLevel || "low"]}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">新风险等级 *</label>
            <div className="grid grid-cols-3 gap-2">
              {riskOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNewLevel(opt.value)}
                  className={cn(
                    "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                    newLevel === opt.value
                      ? "border-nautical bg-nautical/10 " + opt.color
                      : "border-navy-lighter text-gray-400 hover:border-gray-500"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">变更原因 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="请详细说明变更原因..."
              className="w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-nautical transition-colors resize-none"
            />
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-xs text-yellow-200">
                风险等级提升将自动进入监管抽查流程
              </div>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-navy-lighter flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !newLevel || !reason}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              loading || !newLevel || !reason
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-warning hover:bg-warning-light text-white"
            )}
          >
            {loading ? "提交中..." : "确认变更"}
          </button>
        </div>
      </div>
    </div>
  );
}
