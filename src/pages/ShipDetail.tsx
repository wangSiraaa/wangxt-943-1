import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ship as ShipIcon,
  Plus,
  Anchor,
  Wrench,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useDataStore, type Ship } from "@/store/dataStore";

interface Certificate {
  id: string;
  shipId: string;
  type: string;
  issueDate: string;
  expireDate: string;
  status: "valid" | "expiring_soon" | "expired";
}

interface HistoryVoyage {
  id: string;
  plan_id: string;
  departure_time: string;
  actual_return_time: string | null;
  status: string;
}

const certTypes = [
  "渔业捕捞许可证",
  "船舶检验证书",
  "船舶国籍证书",
  "船舶所有权证书",
  "渔业船舶适航证书",
  "船员适任证书",
  "其他",
];

const certStatusStyles: Record<string, string> = {
  valid: "bg-port/20 text-port",
  expiring_soon: "bg-warning/20 text-warning",
  expired: "bg-danger/20 text-danger",
};

const certStatusLabels: Record<string, string> = {
  valid: "有效",
  expiring_soon: "即将过期",
  expired: "已过期",
};

const shipStatusConfig: Record<string, { label: string; color: string; icon: typeof Anchor }> = {
  in_port: { label: "在港", color: "text-port", icon: Anchor },
  at_sea: { label: "出海", color: "text-nautical-light", icon: ShipIcon },
  maintenance: { label: "维修", color: "text-warning", icon: Wrench },
};

function AddCertModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { type: string; issueDate: string; expireDate: string }) => void;
  submitting: boolean;
}) {
  const [type, setType] = useState(certTypes[0]);
  const [issueDate, setIssueDate] = useState("");
  const [expireDate, setExpireDate] = useState("");

  if (!open) return null;

  const valid = type && issueDate && expireDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-navy-light border border-navy-lighter rounded-xl w-full max-w-md mx-4 p-6 animate-fade-in">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">添加证书</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">证书类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical"
            >
              {certTypes.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">签发日期</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">到期日期</label>
            <input
              type="date"
              value={expireDate}
              onChange={(e) => setExpireDate(e.target.value)}
              className="w-full bg-navy-lighter border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => valid && onSubmit({ type, issueDate, expireDate })}
              disabled={submitting || !valid}
              className="flex-1 px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? "提交中..." : "确认添加"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShipDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [ship, setShip] = useState<Ship | null>(null);
  const [voyages, setVoyages] = useState<HistoryVoyage[]>([]);
  const [loading, setLoading] = useState(true);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === "admin" || user?.role === "supervisor";

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [shipRes, voyagesRes] = await Promise.all([
        fetch(`/api/ships/${id}`),
        fetch(`/api/ships/${id}/voyages`),
      ]);
      if (shipRes.ok) setShip(await shipRes.json());
      if (voyagesRes.ok) setVoyages(await voyagesRes.json());
    } catch {
      console.error("获取船舶详情失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCert = async (data: {
    type: string;
    issueDate: string;
    expireDate: string;
  }) => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ships/${id}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setCertModalOpen(false);
        fetchData();
      }
    } catch {
      console.error("添加证书失败");
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

  if (!ship) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">船舶不存在</div>
      </div>
    );
  }

  const st = shipStatusConfig[ship.status] ?? {
    label: ship.status,
    color: "text-gray-400",
    icon: ShipIcon,
  };
  const StatusIcon = st.icon;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="mb-4">
        <a
          href="/ships"
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
              {ship.name}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              ID: {ship.id}
            </p>
          </div>
          <div className={cn("flex items-center gap-1.5", st.color)}>
            <StatusIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{st.label}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-500">船舶类型</span>
            <p className="text-sm text-gray-200 mt-0.5">{ship.type}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">吨位</span>
            <p className="text-sm text-gray-200 mt-0.5">{ship.tonnage}吨</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">船长</span>
            <p className="text-sm text-gray-200 mt-0.5">{ship.length}m</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">状态</span>
            <p className="text-sm text-gray-200 mt-0.5">{st.label}</p>
          </div>
        </div>
      </div>

      <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-gray-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-nautical-light" />
            证书管理
          </h2>
          {canManage && (
            <button
              onClick={() => setCertModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-nautical/20 text-nautical-light text-xs font-medium rounded-lg hover:bg-nautical/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加证书
            </button>
          )}
        </div>

        {(ship as unknown as Record<string, unknown>).certificates && ((ship as unknown as Record<string, unknown>).certificates as Certificate[]).length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            暂无证书记录
          </div>
        ) : (ship as unknown as Record<string, unknown>).certificates ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    证书类型
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    签发日期
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    到期日期
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {((ship as unknown as Record<string, unknown>).certificates as Certificate[]).map((cert) => (
                  <tr
                    key={cert.id}
                    className="border-b border-navy-lighter/50 hover:bg-navy-lighter/30"
                  >
                    <td className="py-3 px-2 text-gray-200">{cert.type}</td>
                    <td className="py-3 px-2 text-gray-300">{cert.issueDate}</td>
                    <td className="py-3 px-2 text-gray-300">{cert.expireDate}</td>
                    <td className="py-3 px-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          certStatusStyles[cert.status]
                        )}
                      >
                        {cert.status === "valid" && (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {cert.status === "expiring_soon" && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {cert.status === "expired" && (
                          <XCircle className="w-3 h-3" />
                        )}
                        {certStatusLabels[cert.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 mb-6 animate-fade-in">
        <h2 className="text-base font-medium text-gray-200 mb-4 flex items-center gap-2">
          <Anchor className="w-4 h-4 text-nautical-light" />
          历史航次
        </h2>

        {voyages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            暂无航次记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    航次编号
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    出港时间
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    返港时间
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {voyages.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => navigate(`/voyages/${v.id}`)}
                    className="border-b border-navy-lighter/50 hover:bg-navy-lighter/30 cursor-pointer"
                  >
                    <td className="py-3 px-2 text-nautical-light hover:underline">
                      {v.id}
                    </td>
                    <td className="py-3 px-2 text-gray-300">
                      {v.departure_time}
                    </td>
                    <td className="py-3 px-2 text-gray-300">
                      {v.actual_return_time ?? "-"}
                    </td>
                    <td className="py-3 px-2 text-gray-300">{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCertModal
        open={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        onSubmit={handleAddCert}
        submitting={submitting}
      />
    </div>
  );
}
