import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Anchor,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ship,
  ArrowLeft,
  Shield,
  TrendingUp,
  FileText,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useDataStore, type Voyage, type Plan, type Ship as ShipType } from "@/store/dataStore";
import StatusBadge from "@/components/StatusBadge";
import Timeline, { type TimelineNode } from "@/components/Timeline";

interface ApprovalRecord {
  id: string;
  step: string;
  operator: string;
  time: string;
  result: "approved" | "rejected" | "pending";
  comment?: string;
}

interface VoyageDetail extends Voyage {
  deviationReason?: string;
  reviewedBy?: string;
  reviewComment?: string;
  closed_by?: string;
  closed_by_name?: string;
  close_reason?: string;
  closed_at?: string;
  return_deviation_hours?: number;
  is_return_overdue?: boolean;
}

interface InspectionRecord {
  id: string;
  inspectionType: string;
  inspectionResult: string;
  inspectorName: string;
  findings: string;
  createdAt: string;
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-navy-light border border-navy-lighter rounded-xl w-full max-w-md mx-4 p-6 animate-fade-in">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">{title}</h3>
        {children}
        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-400 hover:text-gray-200"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export default function VoyageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { plans, ships, fetchPlans, fetchShips } = useDataStore();

  const [voyage, setVoyage] = useState<VoyageDetail | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnTime, setReturnTime] = useState(
    () => new Date().toISOString().slice(0, 16)
  );
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [deviationReason, setDeviationReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [closeReason, setCloseReason] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const [reviewComment, setReviewComment] = useState("");

  const isDutyOfficer = user?.role === "duty_officer" || user?.role === "admin";
  const isSupervisor =
    user?.role === "supervisor" || user?.role === "admin";

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, apprRes, inspRes] = await Promise.all([
        fetch(`/api/voyages/${id}`),
        fetch(`/api/voyages/${id}/approvals`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
        fetch(`/api/inspections?voyage_id=${id}`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
      ]);
      if (res.ok) {
        const data = await res.json();
        setVoyage(data.success ? data.data : data);
      }
      const apprData = apprRes.success ? apprRes.data : apprRes;
      setApprovals(Array.isArray(apprData) ? apprData : []);
      const inspData = inspRes.success ? inspRes.data : inspRes;
      setInspections(Array.isArray(inspData) ? inspData : []);
    } catch {
      setError("获取航次详情失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const getReturnDeviation = () => {
    if (!voyage || !voyage.actual_return_time || !voyage.expected_return_time) {
      return { hours: 0, isOverdue: false, text: "-" };
    }
    const actual = new Date(voyage.actual_return_time).getTime();
    const expected = new Date(voyage.expected_return_time).getTime();
    const diffMs = actual - expected;
    const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    const isOverdue = diffHours > 0;
    const prefix = diffHours > 0 ? "+" : "";
    return {
      hours: diffHours,
      isOverdue,
      text: `${prefix}${diffHours}小时`,
    };
  };

  const handleCreateInspection = async () => {
    if (!id || !voyage) return;
    try {
      const res = await fetch(`/api/voyages/${id}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ship_id: voyage.ship_id,
          inspection_type: "routine",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/inspections/${data.id || data.data?.id}`);
      }
    } catch {
      setError("创建临检记录失败");
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchPlans();
    fetchShips();
  }, [fetchDetail, fetchPlans, fetchShips]);

  useEffect(() => {
    if (voyage?.plan_id && plans.length > 0) {
      setPlan(plans.find((p) => p.id === voyage.plan_id) ?? null);
    }
  }, [voyage?.plan_id, plans]);

  const getShipName = (shipId: string) => ships.find((s) => s.id === shipId)?.name ?? "-";

  const nodeLabels: Record<string, string> = {
    auto_check: "自动校验",
    duty_review: "值班复核",
    supervisor_inspect: "监管抽查",
    dock_release: "码头放行",
  };

  const buildTimeline = (): TimelineNode[] => {
    if (!voyage || !plan) return [];
    const nodes: TimelineNode[] = [
      {
        title: "计划创建",
        time: plan.departure_time,
        operator: plan.captain_name || "船长",
        status: "completed",
      },
      ...approvals.map((a: any) => {
        const node = a.node || a.step || "unknown";
        const action = a.action || a.result || "unknown";
        const operatorName = a.operator_name || a.operatorName || a.operator || "系统";
        const operatorRole = a.operator_role || a.operatorRole || "";
        return {
          title: `${nodeLabels[node] || node} - ${action === "approved" ? "通过" : action === "rejected" ? "驳回" : action}`,
          time: a.created_at || a.time,
          operator: operatorRole ? `${operatorName} (${operatorRole})` : operatorName,
          comment: a.comment,
          status:
            action === "approved"
              ? ("completed" as const)
              : action === "rejected" || action === "revoked"
              ? ("completed" as const)
              : action === "pending"
              ? ("current" as const)
              : ("completed" as const),
        };
      }),
      {
        title: "出港放行",
        time: voyage.departure_time,
        operator: "码头值班员",
        status: ["released", "active", "returning", "abnormal_return", "closed"].includes(voyage.status)
          ? "completed"
          : "pending",
      },
      {
        title: "出海作业",
        time: voyage.departure_time,
        status: ["active", "returning", "abnormal_return", "closed"].includes(voyage.status)
          ? "completed"
          : voyage.status === "released"
            ? "current"
            : "pending",
      },
    ];

    if (voyage.status === "abnormal_return") {
      nodes.push({
        title: "异常返航",
        time: voyage.actual_return_time ?? undefined,
        operator: "值班员登记",
        comment: voyage.return_deviation,
        status: "current",
      });
    } else if (voyage.status === "returning") {
      nodes.push({
        title: "正常返航",
        time: voyage.actual_return_time ?? undefined,
        operator: "值班员登记",
        status: "current",
      });
    } else if (voyage.status === "closed") {
      if (voyage.actual_return_time) {
        nodes.push({
          title: "返航归港",
          time: voyage.actual_return_time,
          operator: "值班员登记",
          comment: voyage.return_deviation,
          status: "completed",
        });
      }
      if (voyage.return_deviation) {
        nodes.push({
          title: "异常返航审核",
          operator: voyage.reviewed_by ? `${voyage.reviewed_by} (监管员)` : "监管员审核",
          comment: voyage.review_comment,
          status: "completed",
        });
      }
      nodes.push({
        title: "航次关闭",
        time: voyage.closed_at,
        operator: voyage.closed_by_name
          ? `${voyage.closed_by_name} (监管员)`
          : "监管员关闭",
        comment: voyage.close_reason,
        status: "completed",
      });
    } else {
      nodes.push({
        title: "返航归港",
        status: "pending",
      });
      nodes.push({
        title: "航次关闭",
        status: "pending",
      });
    }

    return nodes;
  };

  const handleRegisterReturn = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/voyages/${id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_return_time: returnTime,
          is_abnormal: isAbnormal,
          return_deviation: isAbnormal ? deviationReason : undefined,
        }),
      });
      if (res.ok) {
        setReturnModalOpen(false);
        setDeviationReason("");
        setIsAbnormal(false);
        fetchDetail();
      }
    } catch {
      console.error("登记返航失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewReturn = async (approved: boolean) => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/voyages/${id}/review-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, comment: reviewComment }),
      });
      if (res.ok) {
        setReviewComment("");
        fetchDetail();
      }
    } catch {
      console.error("审核返航失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseVoyage = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/voyages/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: closeReason }),
      });
      if (res.ok) {
        setCloseReason("");
        setCloseConfirmOpen(false);
        fetchDetail();
      }
    } catch {
      console.error("关闭航次失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">航次不存在</div>
      </div>
    );
  }

  const status = voyage.status as "active" | "returning" | "abnormal_return" | "closed";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="mb-4">
        <a
          href="/plans"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </a>
      </div>

      <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">
              航次 {voyage.id}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              <Ship className="w-4 h-4 inline mr-1" />
              {getShipName(voyage.ship_id)}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-500">出港时间</span>
            <p className="text-sm text-gray-200 mt-0.5">
              {voyage.departure_time || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">预计返港</span>
            <p className="text-sm text-gray-200 mt-0.5">
              {voyage.expected_return_time || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">实际返港</span>
            <p className="text-sm text-gray-200 mt-0.5">
              {voyage.actual_return_time || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">关联计划</span>
            <p className="text-sm text-nautical-light mt-0.5">
              {plan ? plan.id : "-"}
            </p>
          </div>
          {voyage.actual_return_time && (
            <>
              <div>
                <span className="text-xs text-gray-500">返港偏差</span>
                <p
                  className={cn(
                    "text-sm mt-0.5 font-medium",
                    getReturnDeviation().isOverdue
                      ? "text-danger-light"
                      : "text-success"
                  )}
                >
                  {getReturnDeviation().text}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">超时预警</span>
                <p className="text-sm mt-0.5">
                  {voyage.is_return_overdue || getReturnDeviation().isOverdue ? (
                    <span className="text-danger-light flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      已超时
                    </span>
                  ) : (
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      正常
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
          {voyage.status === "closed" && (
            <>
              <div>
                <span className="text-xs text-gray-500">关闭人</span>
                <p className="text-sm text-gray-200 mt-0.5">
                  {voyage.closed_by_name || "-"}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">关闭时间</span>
                <p className="text-sm text-gray-200 mt-0.5">
                  {voyage.closed_at || "-"}
                </p>
              </div>
            </>
          )}
        </div>

        {voyage.close_reason && (
          <div className="mt-4 bg-navy border border-navy-lighter rounded-lg p-3">
            <span className="text-xs text-gray-500">关闭原因</span>
            <p className="text-sm text-gray-300 mt-1">{voyage.close_reason}</p>
          </div>
        )}
      </div>

      <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
        <h2 className="text-base font-medium text-gray-200 mb-4">航次时间线</h2>
        <Timeline nodes={buildTimeline()} />
      </div>

      {inspections.length > 0 && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-nautical-light" />
            监管临检记录
          </h2>
          <div className="space-y-3">
            {inspections.map((insp: any) => (
              <div
                key={insp.id}
                className="bg-navy border border-navy-lighter rounded-lg p-3 cursor-pointer hover:border-gray-500 transition-colors"
                onClick={() => navigate(`/inspections/${insp.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded font-medium",
                        insp.inspection_result === "passed"
                          ? "bg-success/20 text-success"
                          : insp.inspection_result === "failed"
                          ? "bg-danger/20 text-danger"
                          : "bg-yellow-900/30 text-yellow-400"
                      )}
                    >
                      {insp.inspection_result === "passed"
                        ? "合格"
                        : insp.inspection_result === "failed"
                        ? "不合格"
                        : "待处理"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {insp.inspection_type === "routine"
                        ? "常规检查"
                        : insp.inspection_type === "special"
                        ? "专项检查"
                        : "抽查"}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(insp.created_at || insp.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  检查人员: {insp.inspector_name || insp.inspectorName || "未知"}
                </div>
                {insp.findings && (
                  <div className="text-xs text-gray-500 mt-1">
                    检查结果: {insp.findings}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSupervisor && ["active", "returning", "abnormal_return"].includes(status) && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-nautical-light" />
            监管操作
          </h2>
          <button
            onClick={handleCreateInspection}
            className="flex items-center gap-1.5 px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建临检记录
          </button>
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger-light rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {status === "active" && isDutyOfficer && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <Anchor className="w-4 h-4 text-nautical-light" />
            返航登记
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            登记船舶返港信息，完成航次返航流程
          </p>
          <button
            onClick={() => setReturnModalOpen(true)}
            className="px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors"
          >
            登记返航
          </button>
        </div>
      )}

      {status === "abnormal_return" && isSupervisor && (
        <div className="bg-navy-light border border-warning/30 rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-warning mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            异常返航审核
          </h2>
          {voyage.return_deviation && (
            <div className="bg-navy-lighter/50 rounded-lg p-4 mb-4">
              <span className="text-xs text-gray-500">偏离原因</span>
              <p className="text-sm text-gray-200 mt-1">
                {voyage.return_deviation}
              </p>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">审核意见</label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
              placeholder="输入审核意见..."
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleReviewReturn(true)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-port hover:bg-port-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              批准
            </button>
            <button
              onClick={() => handleReviewReturn(false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              驳回
            </button>
          </div>
        </div>
      )}

      {status === "returning" && isSupervisor && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-nautical-light" />
            关闭航次
          </h2>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">关闭原因</label>
            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={3}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
              placeholder="输入关闭原因（可选）..."
            />
          </div>
          <button
            onClick={() => setCloseConfirmOpen(true)}
            className="px-4 py-2 bg-port hover:bg-port-light text-white text-sm font-medium rounded-lg transition-colors"
          >
            确认关闭航次
          </button>
        </div>
      )}

      <Modal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title="登记返航"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              实际返港时间
            </label>
            <input
              type="datetime-local"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300">异常返航</label>
            <button
              type="button"
              onClick={() => setIsAbnormal(!isAbnormal)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isAbnormal ? "bg-warning" : "bg-gray-600"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isAbnormal ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          {isAbnormal && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                偏离原因
              </label>
              <textarea
                value={deviationReason}
                onChange={(e) => setDeviationReason(e.target.value)}
                rows={3}
                className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
                placeholder="请说明偏离原因..."
              />
            </div>
          )}
          <button
            onClick={handleRegisterReturn}
            disabled={submitting || (isAbnormal && !deviationReason.trim())}
            className="w-full px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "提交中..." : "确认登记"}
          </button>
        </div>
      </Modal>

      <Modal
        open={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        title="确认关闭航次"
      >
        <p className="text-sm text-gray-300 mb-4">
          确认关闭航次 <span className="text-gray-100 font-medium">{voyage.id}</span>？
          关闭后将无法修改。
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleCloseVoyage}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-port hover:bg-port-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "关闭中..." : "确认关闭"}
          </button>
          <button
            onClick={() => setCloseConfirmOpen(false)}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </Modal>
    </div>
  );
}
