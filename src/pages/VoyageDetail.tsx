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
  Route,
  Users,
  Home,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useDataStore, type Voyage, type Plan, type Ship as ShipType, type StatusChangeLog, type VoyageChangeRequest } from "@/store/dataStore";
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
  closedByName?: string;
  returnDeviationHours?: number;
  isReturnOverdue?: boolean;
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

  const [statusLogs, setStatusLogs] = useState<StatusChangeLog[]>([]);
  const [changeRequests, setChangeRequests] = useState<VoyageChangeRequest[]>([]);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeForm, setChangeForm] = useState({
    requestType: "route_change" as "route_change" | "crew_change" | "early_return",
    newValue: "",
    changeReason: "",
  });
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const [showChangeReviewModal, setShowChangeReviewModal] = useState(false);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<VoyageChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewChangeComment, setReviewChangeComment] = useState("");

  const isDutyOfficer = user?.role === "duty_officer" || user?.role === "admin";
  const isSupervisor =
    user?.role === "supervisor" || user?.role === "admin";

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, apprRes, inspRes, logRes, crRes] = await Promise.all([
        fetch(`/api/voyages/${id}`),
        fetch(`/api/voyages/${id}/approvals`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
        fetch(`/api/inspections?voyage_id=${id}`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
        fetch(`/api/emergency/voyage-status-logs/${id}`).then((r) =>
          r.json().catch(() => ({ success: true, data: [] }))
        ),
        fetch(`/api/change-requests?voyageId=${id}`).then((r) =>
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
      const logData = logRes.success ? logRes.data : logRes;
      setStatusLogs(Array.isArray(logData) ? logData : []);
      const crData = crRes.success ? crRes.data : crRes;
      setChangeRequests(Array.isArray(crData) ? crData : []);
    } catch {
      setError("获取航次详情失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const getReturnDeviation = () => {
    if (!voyage || !voyage.actualReturnTime || !voyage.expectedReturnTime) {
      return { hours: 0, isOverdue: false, text: "-" };
    }
    const actual = new Date(voyage.actualReturnTime).getTime();
    const expected = new Date(voyage.expectedReturnTime).getTime();
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
          shipId: voyage.shipId,
          inspectionType: "routine",
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
    if (voyage?.planId && plans.length > 0) {
      setPlan(plans.find((p) => p.id === voyage.planId) ?? null);
    }
  }, [voyage?.planId, plans]);

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
        time: plan.departureTime,
        operator: (plan as any).captainName || "船长",
        status: "completed",
      },
      ...approvals.map((a: any) => {
        const node = a.node || a.step || "unknown";
        const action = a.action || a.result || "unknown";
        const operatorName = a.operatorName || a.operator || "系统";
        const operatorRole = a.operatorRole || "";
        return {
          title: `${nodeLabels[node] || node} - ${action === "approved" ? "通过" : action === "rejected" ? "驳回" : action}`,
          time: a.createdAt || a.time,
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
        time: voyage.departureTime,
        operator: "码头值班员",
        status: ["released", "active", "returning", "abnormal_return", "closed"].includes(voyage.status)
          ? "completed"
          : "pending",
      },
      {
        title: "出海作业",
        time: voyage.departureTime,
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
        time: voyage.actualReturnTime ?? undefined,
        operator: "值班员登记",
        comment: voyage.returnDeviation,
        status: "current",
      });
    } else if (voyage.status === "returning") {
      nodes.push({
        title: "正常返航",
        time: voyage.actualReturnTime ?? undefined,
        operator: "值班员登记",
        status: "current",
      });
    } else if (voyage.status === "closed") {
      if (voyage.actualReturnTime) {
        nodes.push({
          title: "返航归港",
          time: voyage.actualReturnTime,
          operator: "值班员登记",
          comment: voyage.returnDeviation,
          status: "completed",
        });
      }
      if (voyage.returnDeviation) {
        nodes.push({
          title: "异常返航审核",
          operator: voyage.reviewedBy ? `${voyage.reviewedBy} (监管员)` : "监管员审核",
          comment: voyage.reviewComment,
          status: "completed",
        });
      }
      nodes.push({
        title: "航次关闭",
        time: voyage.closedAt,
        operator: voyage.closedByName
          ? `${voyage.closedByName} (监管员)`
          : "监管员关闭",
        comment: voyage.closeReason,
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
          actualReturnTime: returnTime,
          isAbnormal: isAbnormal,
          returnDeviation: isAbnormal ? deviationReason : undefined,
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

  const handleSubmitChangeRequest = async () => {
    if (!id || !voyage || !plan) return;
    setChangeSubmitting(true);
    try {
      const res = await fetch("/api/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          voyageId: id,
          requestType: changeForm.requestType,
          newValue: changeForm.newValue,
          changeReason: changeForm.changeReason,
        }),
      });
      if (res.ok) {
        setShowChangeModal(false);
        setChangeForm({ requestType: "route_change", newValue: "", changeReason: "" });
        fetchDetail();
      }
    } catch {
      console.error("提交变更申请失败");
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleReviewChangeRequest = async () => {
    if (!selectedChangeRequest) return;
    setChangeSubmitting(true);
    try {
      const res = await fetch(`/api/change-requests/${selectedChangeRequest.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          reviewComment: reviewChangeComment,
        }),
      });
      if (res.ok) {
        setShowChangeReviewModal(false);
        setSelectedChangeRequest(null);
        setReviewChangeComment("");
        fetchDetail();
      }
    } catch {
      console.error("审核变更申请失败");
    } finally {
      setChangeSubmitting(false);
    }
  };

  const isCaptain = user?.role === "captain" || user?.role === "admin";
  const changeTypeLabels: Record<string, string> = {
    route_change: "改航线",
    crew_change: "换船员",
    early_return: "提前返港",
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
              {getShipName(voyage.shipId)}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-500">出港时间</span>
            <p className="text-sm text-gray-200 mt-0.5">
              {voyage.departureTime || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">预计返港</span>
            <p className="text-sm text-gray-200 mt-0.5">
              {voyage.expectedReturnTime || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">实际返港</span>
            <p className="text-sm text-gray-200 mt-0.5">
              {voyage.actualReturnTime || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">关联计划</span>
            <p className="text-sm text-nautical-light mt-0.5">
              {plan ? plan.id : "-"}
            </p>
          </div>
          {voyage.actualReturnTime && (
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
                  {voyage.isReturnOverdue || getReturnDeviation().isOverdue ? (
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
                  {voyage.closedByName || "-"}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">关闭时间</span>
                <p className="text-sm text-gray-200 mt-0.5">
                  {voyage.closedAt || "-"}
                </p>
              </div>
            </>
          )}
        </div>

        {voyage.closeReason && (
          <div className="mt-4 bg-navy border border-navy-lighter rounded-lg p-3">
            <span className="text-xs text-gray-500">关闭原因</span>
            <p className="text-sm text-gray-300 mt-1">{voyage.closeReason}</p>
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
                        insp.inspectionResult === "passed"
                          ? "bg-success/20 text-success"
                          : insp.inspectionResult === "failed"
                          ? "bg-danger/20 text-danger"
                          : "bg-yellow-900/30 text-yellow-400"
                      )}
                    >
                      {insp.inspectionResult === "passed"
                        ? "合格"
                        : insp.inspectionResult === "failed"
                        ? "不合格"
                        : "待处理"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {insp.inspectionType === "routine"
                        ? "常规检查"
                        : insp.inspectionType === "special"
                        ? "专项检查"
                        : "抽查"}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(insp.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  检查人员: {insp.inspectorName || "未知"}
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

      {["active", "returning"].includes(status) && isCaptain && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-nautical-light" />
            航次变更申请
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            因应急管控或实际需要，申请改航线、换船员或提前返港
          </p>
          <button
            onClick={() => setShowChangeModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            提交变更申请
          </button>
        </div>
      )}

      {changeRequests.length > 0 && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-nautical-light" />
            变更申请记录
          </h2>
          <div className="space-y-3">
            {changeRequests.map((cr) => (
              <div
                key={cr.id}
                className={cn(
                  "bg-navy border rounded-lg p-3",
                  cr.status === "pending"
                    ? "border-yellow-600/30"
                    : cr.status === "approved"
                    ? "border-port/30"
                    : "border-navy-lighter"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-200">
                      {changeTypeLabels[cr.requestType]}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        cr.status === "pending"
                          ? "bg-yellow-600/20 text-yellow-400"
                          : cr.status === "approved"
                          ? "bg-port/20 text-port"
                          : cr.status === "rejected"
                          ? "bg-danger/20 text-danger"
                          : "bg-gray-600/20 text-gray-400"
                      )}
                    >
                      {cr.status === "pending"
                        ? "待审核"
                        : cr.status === "approved"
                        ? "已批准"
                        : cr.status === "rejected"
                        ? "已驳回"
                        : "已取消"}
                    </span>
                    {(cr.recheckCertificate || cr.recheckBerth || cr.recheckWeather || cr.recheckInspection) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
                        需复核
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(cr.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  原值: {cr.oldValue || "-"} → 新值: {cr.newValue}
                </div>
                <div className="text-xs text-gray-500">
                  原因: {cr.changeReason}
                </div>
                {(cr.recheckCertificate || cr.recheckBerth || cr.recheckWeather || cr.recheckInspection) && (
                  <div className="flex gap-2 mt-2">
                    {cr.recheckCertificate === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger-light">证书待查</span>
                    )}
                    {cr.recheckBerth === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger-light">泊位待查</span>
                    )}
                    {cr.recheckWeather === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger-light">气象待查</span>
                    )}
                    {cr.recheckInspection === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger-light">抽查待查</span>
                    )}
                  </div>
                )}
                {cr.status === "pending" && isSupervisor && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setSelectedChangeRequest(cr);
                        setReviewAction("approve");
                        setShowChangeReviewModal(true);
                      }}
                      className="px-3 py-1 text-xs bg-port hover:bg-port-light text-white rounded-lg transition-colors"
                    >
                      批准
                    </button>
                    <button
                      onClick={() => {
                        setSelectedChangeRequest(cr);
                        setReviewAction("reject");
                        setShowChangeReviewModal(true);
                      }}
                      className="px-3 py-1 text-xs bg-danger hover:bg-danger-light text-white rounded-lg transition-colors"
                    >
                      驳回
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {statusLogs.length > 0 && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
          <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-port" />
            完整状态变更记录
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {statusLogs.map((log) => {
              const changeTypeLabelsLocal: Record<string, string> = {
                auto_reject: "自动打回",
                manual_release: "人工放行",
                revoke_release: "撤销放行",
                abnormal_close: "异常关闭",
                emergency_reject: "应急打回",
                control_review: "管控复核",
                control_recall: "管控召回",
                change_request: "变更申请",
              };
              return (
                <div
                  key={log.id}
                  className="bg-navy border border-navy-lighter rounded-lg p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          ["auto_reject", "emergency_reject"].includes(log.changeType)
                            ? "bg-danger/20 text-danger"
                            : log.changeType === "manual_release"
                            ? "bg-port/20 text-port"
                            : ["revoke_release", "control_recall"].includes(log.changeType)
                            ? "bg-purple-600/20 text-purple-400"
                            : "bg-yellow-600/20 text-yellow-400"
                        )}
                      >
                        {changeTypeLabelsLocal[log.changeType] || log.changeType}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {log.oldStatus} → {log.newStatus}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600">
                      {log.operatorName || log.operatorRole} ·{" "}
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{log.reason}</div>
                  {log.controlTitle && (
                    <div className="text-[10px] text-warning mt-1">
                      关联管控: {log.controlTitle}
                    </div>
                  )}
                </div>
              );
            })}
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
          {voyage.returnDeviation && (
            <div className="bg-navy-lighter/50 rounded-lg p-4 mb-4">
              <span className="text-xs text-gray-500">偏离原因</span>
              <p className="text-sm text-gray-200 mt-1">
                {voyage.returnDeviation}
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

      <Modal
        open={showChangeModal}
        onClose={() => setShowChangeModal(false)}
        title="提交航次变更申请"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">变更类型 *</label>
            <div className="flex gap-2">
              {([
                { value: "route_change", label: "改航线", icon: Route },
                { value: "crew_change", label: "换船员", icon: Users },
                { value: "early_return", label: "提前返港", icon: Home },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setChangeForm({ ...changeForm, requestType: opt.value })
                  }
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors",
                    changeForm.requestType === opt.value
                      ? "border-nautical bg-nautical/10 text-nautical-light"
                      : "border-navy-lighter text-gray-400 hover:border-gray-500"
                  )}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {changeForm.requestType === "route_change"
                ? "新航线 *"
                : changeForm.requestType === "crew_change"
                ? "新船员ID（逗号分隔） *"
                : "新返港时间 *"}
            </label>
            {changeForm.requestType === "early_return" ? (
              <input
                type="datetime-local"
                value={changeForm.newValue}
                onChange={(e) =>
                  setChangeForm({ ...changeForm, newValue: e.target.value })
                }
                className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical"
              />
            ) : (
              <input
                value={changeForm.newValue}
                onChange={(e) =>
                  setChangeForm({ ...changeForm, newValue: e.target.value })
                }
                className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
                placeholder={
                  changeForm.requestType === "route_change"
                    ? "如：南海渔场B区航线"
                    : "如：cr1,cr2,cr3"
                }
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">变更原因 *</label>
            <textarea
              value={changeForm.changeReason}
              onChange={(e) =>
                setChangeForm({ ...changeForm, changeReason: e.target.value })
              }
              rows={3}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
              placeholder="说明变更原因，如应急管控要求避让..."
            />
          </div>
          <div className="bg-navy-lighter/50 border border-navy-lighter rounded-lg p-3 text-xs text-gray-500">
            <RefreshCw className="w-3 h-3 inline mr-1" />
            提交后系统将自动检查：证书有效性、泊位可用性、气象窗口、监管抽查要求
          </div>
          <button
            onClick={handleSubmitChangeRequest}
            disabled={changeSubmitting || !changeForm.newValue || !changeForm.changeReason.trim()}
            className="w-full px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {changeSubmitting ? "提交中..." : "提交变更申请"}
          </button>
        </div>
      </Modal>

      <Modal
        open={showChangeReviewModal}
        onClose={() => setShowChangeReviewModal(false)}
        title={`审核变更申请 - ${reviewAction === "approve" ? "批准" : "驳回"}`}
      >
        {selectedChangeRequest && (
          <div className="space-y-4">
            <div className="bg-navy-lighter/50 border border-navy-lighter rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">
                  变更类型: {changeTypeLabels[selectedChangeRequest.requestType]}
                </div>
                <div className="text-xs text-gray-300">
                  原值: {selectedChangeRequest.oldValue || "-"} → 新值: {selectedChangeRequest.newValue}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  原因: {selectedChangeRequest.changeReason}
                </div>
              </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">审核意见</label>
              <textarea
                value={reviewChangeComment}
                onChange={(e) => setReviewChangeComment(e.target.value)}
                rows={3}
                className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
                placeholder="输入审核意见..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReviewChangeRequest}
                disabled={changeSubmitting}
                className={cn(
                  "flex-1 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
                  reviewAction === "approve"
                    ? "bg-port hover:bg-port-light"
                    : "bg-danger hover:bg-danger-light"
                )}
              >
                {changeSubmitting
                  ? "审核中..."
                  : reviewAction === "approve"
                  ? "确认批准"
                  : "确认驳回"}
              </button>
              <button
                onClick={() => setShowChangeReviewModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
