import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldAlert,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Ship,
  History,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useDataStore, EmergencyControl, Plan, Voyage, StatusChangeLog } from "@/store/dataStore";
import { cn } from "@/lib/utils";

const controlTypeLabels: Record<string, string> = {
  temporary_ban: "临时禁航",
  search_rescue: "搜救演练",
  area_avoidance: "海域避让",
};

const statusLabels: Record<string, string> = {
  active: "进行中",
  ended: "已结束",
  cancelled: "已取消",
};

const statusColors: Record<string, string> = {
  active: "bg-warning/20 text-warning border-warning/30",
  ended: "bg-success/20 text-success border-success/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const riskLevelColors: Record<string, string> = {
  critical: "bg-critical/20 text-critical border-critical/30",
  high: "bg-danger/20 text-danger border-danger/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-success/20 text-success border-success/30",
};

const riskLevelLabels: Record<string, string> = {
  critical: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

const planStatusLabels: Record<string, string> = {
  draft: "草稿",
  submitted: "待复核",
  reviewing: "复核中",
  inspected: "待抽查",
  inspecting: "抽查中",
  approved: "待放行",
  released: "已放行",
  active: "航行中",
  returning: "返航中",
  abnormal_return: "异常返港",
  closed: "已关闭",
  completed: "已完成",
  rejected: "已打回",
  revoked: "已撤销",
  withdrawn: "已撤回",
};

const planStatusColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  submitted: "bg-info/20 text-info",
  reviewing: "bg-info/20 text-info",
  inspected: "bg-warning/20 text-warning",
  inspecting: "bg-warning/20 text-warning",
  approved: "bg-success/20 text-success",
  released: "bg-success/20 text-success",
  active: "bg-nautical/20 text-nautical-light",
  returning: "bg-nautical/20 text-nautical-light",
  abnormal_return: "bg-danger/20 text-danger",
  closed: "bg-gray-500/20 text-gray-400",
  completed: "bg-gray-500/20 text-gray-400",
  rejected: "bg-danger/20 text-danger",
  revoked: "bg-warning/20 text-warning",
  withdrawn: "bg-gray-500/20 text-gray-400",
};

const changeTypeLabels: Record<string, string> = {
  auto_reject: "自动打回",
  manual_release: "人工放行",
  revoke_release: "撤销放行",
  abnormal_close: "异常关闭",
  emergency_reject: "管控打回",
  control_review: "管控复核",
  control_recall: "管控召回",
  change_request: "变更申请",
};

const changeTypeColors: Record<string, string> = {
  auto_reject: "bg-danger/20 text-danger",
  manual_release: "bg-success/20 text-success",
  revoke_release: "bg-warning/20 text-warning",
  abnormal_close: "bg-critical/20 text-critical",
  emergency_reject: "bg-danger/20 text-danger",
  control_review: "bg-info/20 text-info",
  control_recall: "bg-warning/20 text-warning",
  change_request: "bg-nautical/20 text-nautical-light",
};

export default function EmergencyControlDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchEmergencyControls, endEmergencyControl, fetchStatusChangeLogs } = useDataStore();

  const [control, setControl] = useState<EmergencyControl | null>(null);
  const [affectedPlans, setAffectedPlans] = useState<Plan[]>([]);
  const [affectedVoyages, setAffectedVoyages] = useState<Voyage[]>([]);
  const [statusLogs, setStatusLogs] = useState<StatusChangeLog[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'voyages' | 'logs'>('plans');
  const [loading, setLoading] = useState(true);

  const canEnd = (user?.role === "supervisor" || user?.role === "admin") && control?.status === "active";

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const controlData = await apiRequest<EmergencyControl>(`/api/emergency/${id}`);

      setControl(controlData);
      setAffectedPlans(controlData.affectedPlans || []);
      setAffectedVoyages(controlData.affectedVoyages || []);
      setStatusLogs(controlData.statusLogs || []);
    } catch (error) {
      console.error("加载管控详情失败", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!control || !confirm("确认结束该应急管控？结束后将恢复所有受影响航次的正常状态。")) return;
    
    const success = await endEmergencyControl(control.id, "监管员手动结束");
    if (success) {
      fetchEmergencyControls();
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-nautical border-t-transparent"></div>
      </div>
    );
  }

  if (!control) {
    return (
      <div className="text-center py-16">
        <ShieldAlert className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">管控记录不存在</p>
        <button
          onClick={() => navigate("/emergency")}
          className="mt-4 text-nautical hover:text-nautical-light transition-colors"
        >
          返回列表
        </button>
      </div>
    );
  }

  const pendingPlans = affectedPlans.filter(p => p.status === 'rejected' || p.status === 'submitted');
  const processingVoyages = affectedVoyages.filter(v => v.status === 'closed' || v.status === 'abnormal_return');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/emergency")}
          className="p-2 hover:bg-navy-lighter rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{control.title}</h1>
            <span
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border",
                statusColors[control.status]
              )}
            >
              {statusLabels[control.status]}
            </span>
            <span
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border",
                riskLevelColors[control.riskLevel]
              )}
            >
              {riskLevelLabels[control.riskLevel]}风险
            </span>
          </div>
          <p className="text-gray-400 mt-1">{controlTypeLabels[control.controlType]}</p>
        </div>
        {canEnd && (
          <button
            onClick={handleEnd}
            className="flex items-center gap-2 px-4 py-2.5 bg-danger hover:bg-danger/80 text-white rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5" />
            <span>结束管控</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-navy-light rounded-xl border border-navy-lighter p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-gray-400">管控时间</p>
              <p className="font-medium text-white">
                {new Date(control.startTime).toLocaleString("zh-CN")}
              </p>
              <p className="text-sm text-gray-400">至 {new Date(control.endTime).toLocaleString("zh-CN")}</p>
            </div>
          </div>
        </div>

        {control.affectedArea && (
          <div className="bg-navy-light rounded-xl border border-navy-lighter p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-nautical/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-nautical-light" />
              </div>
              <div>
                <p className="text-sm text-gray-400">影响区域</p>
                <p className="font-medium text-white">{control.affectedArea}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-navy-light rounded-xl border border-navy-lighter p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <User className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-gray-400">发布人</p>
              <p className="font-medium text-white">{control.createdByName || "系统"}</p>
              <p className="text-sm text-gray-400">{new Date(control.createdAt).toLocaleString("zh-CN")}</p>
            </div>
          </div>
        </div>
      </div>

      {control.description && (
        <div className="bg-navy-light rounded-xl border border-navy-lighter p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-2">管控说明</h3>
          <p className="text-white">{control.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-navy-light rounded-xl border border-navy-lighter p-4 text-center">
          <p className="text-3xl font-bold text-white">{affectedPlans.length}</p>
          <p className="text-sm text-gray-400 mt-1">受影响计划</p>
        </div>
        <div className="bg-navy-light rounded-xl border border-navy-lighter p-4 text-center">
          <p className="text-3xl font-bold text-warning">{pendingPlans.length}</p>
          <p className="text-sm text-gray-400 mt-1">待处理计划</p>
        </div>
        <div className="bg-navy-light rounded-xl border border-navy-lighter p-4 text-center">
          <p className="text-3xl font-bold text-nautical-light">{affectedVoyages.length}</p>
          <p className="text-sm text-gray-400 mt-1">受影响航次</p>
        </div>
        <div className="bg-navy-light rounded-xl border border-navy-lighter p-4 text-center">
          <p className="text-3xl font-bold text-white">{statusLogs.length}</p>
          <p className="text-sm text-gray-400 mt-1">状态变更记录</p>
        </div>
      </div>

      <div className="bg-navy-light rounded-xl border border-navy-lighter overflow-hidden">
        <div className="flex border-b border-navy-lighter">
          <button
            onClick={() => setActiveTab('plans')}
            className={cn(
              "flex-1 px-6 py-3 text-sm font-medium transition-colors",
              activeTab === 'plans'
                ? "text-white bg-navy border-b-2 border-nautical"
                : "text-gray-400 hover:text-white"
            )}
          >
            受影响计划 ({affectedPlans.length})
          </button>
          <button
            onClick={() => setActiveTab('voyages')}
            className={cn(
              "flex-1 px-6 py-3 text-sm font-medium transition-colors",
              activeTab === 'voyages'
                ? "text-white bg-navy border-b-2 border-nautical"
                : "text-gray-400 hover:text-white"
            )}
          >
            受影响航次 ({affectedVoyages.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              "flex-1 px-6 py-3 text-sm font-medium transition-colors",
              activeTab === 'logs'
                ? "text-white bg-navy border-b-2 border-nautical"
                : "text-gray-400 hover:text-white"
            )}
          >
            处理日志 ({statusLogs.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'plans' && (
            <div className="space-y-3">
              {affectedPlans.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无受影响计划</p>
              ) : (
                affectedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-4 bg-navy rounded-xl hover:bg-navy-lighter/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-nautical/20 flex items-center justify-center">
                        <Ship className="w-5 h-5 text-nautical-light" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{plan.shipName || `计划 #${plan.id.slice(0, 8)}`}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            planStatusColors[plan.status] || "bg-gray-500/20 text-gray-400"
                          )}>
                            {planStatusLabels[plan.status] || plan.status}
                          </span>
                          {plan.lastStatusChangeReason && (
                            <span className="text-gray-400 line-clamp-1">
                              {plan.lastStatusChangeReason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/plans/${plan.id}`)}
                        className="p-2 hover:bg-navy-lighter rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'voyages' && (
            <div className="space-y-3">
              {affectedVoyages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无受影响航次</p>
              ) : (
                affectedVoyages.map((voyage) => (
                  <div
                    key={voyage.id}
                    className="flex items-center justify-between p-4 bg-navy rounded-xl hover:bg-navy-lighter/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-nautical/20 flex items-center justify-center">
                        <Ship className="w-5 h-5 text-nautical-light" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{voyage.shipName || `航次 #${voyage.id.slice(0, 8)}`}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            planStatusColors[voyage.status] || "bg-gray-500/20 text-gray-400"
                          )}>
                            {planStatusLabels[voyage.status] || voyage.status}
                          </span>
                          <span className="text-gray-400">
                            计划 ID: {voyage.planId.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/voyages/${voyage.id}`)}
                      className="p-2 hover:bg-navy-lighter rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              {statusLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无处理日志</p>
              ) : (
                statusLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-4 p-4 bg-navy rounded-xl"
                  >
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        changeTypeColors[log.changeType] || "bg-gray-500/20"
                      )}>
                        {log.changeType.includes('reject') || log.changeType === 'abnormal_close' ? (
                          <XCircle className="w-4 h-4" />
                        ) : log.changeType.includes('release') ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <History className="w-4 h-4" />
                        )}
                      </div>
                      <div className="w-px h-full bg-navy-lighter mt-2" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs",
                          changeTypeColors[log.changeType] || "bg-gray-500/20"
                        )}>
                          {changeTypeLabels[log.changeType] || log.changeType}
                        </span>
                        <span className="text-sm text-gray-400">
                          {new Date(log.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <p className="text-white mt-2">{log.reason}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <span>操作人: {log.operatorName || log.operatorId.slice(0, 8)}</span>
                        <span>角色: {log.operatorRole}</span>
                        {log.oldStatus && log.newStatus && (
                          <span>
                            {log.oldStatus} → {log.newStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
