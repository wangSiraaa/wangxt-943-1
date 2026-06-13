import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, Shield, Ship, User, Calendar } from "lucide-react";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface Inspection {
  id: string;
  voyageId: string;
  shipId: string;
  shipName?: string;
  inspectorId: string;
  inspectorName?: string;
  inspectionType: string;
  inspectionResult: string;
  certificateCheck: number;
  crewCheck: number;
  cargoCheck: number;
  findings?: string;
  comment?: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  routine: "常规检查",
  special: "专项检查",
  spot_check: "抽查",
};

const resultLabels: Record<string, string> = {
  pending: "待处理",
  passed: "合格",
  failed: "不合格",
};

const resultColors: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-400",
  passed: "bg-success/20 text-success",
  failed: "bg-danger/20 text-danger",
};

const tabs: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待处理" },
  { key: "passed", label: "合格" },
  { key: "failed", label: "不合格" },
];

export default function Inspections() {
  const { ships, fetchShips } = useDataStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ ship_id: "", inspection_type: "", inspection_result: "" });

  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";

  useEffect(() => {
    fetchInspections();
    fetchShips();
  }, [filter]);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.ship_id) params.append("ship_id", filter.ship_id);
      if (filter.inspection_type) params.append("inspection_type", filter.inspection_type);
      if (filter.inspection_result && filter.inspection_result !== "all")
        params.append("inspection_result", filter.inspection_result);

      const res = await fetch(`/api/inspections?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.success ? data.data : data;
        setInspections(Array.isArray(list) ? list : []);
      }
    } catch {
      console.error("获取临检记录失败");
    } finally {
      setLoading(false);
    }
  };

  const getShipName = (shipId: string) => ships.find((s) => s.id === shipId)?.name ?? "-";

  const filtered =
    activeTab === "all"
      ? inspections
      : inspections.filter((i) => i.inspectionResult === activeTab);

  const CheckItem = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-gray-500">{label}:</span>
      <span className={value ? "text-success" : "text-danger"}>{value ? "✓" : "✗"}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-nautical-light" />
            监管临检
          </h1>
          {isSupervisor && (
            <button
              onClick={() => navigate("/inspections/new")}
              className="flex items-center gap-1.5 px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建检查
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">管理船舶监管临检记录</p>
      </div>

      <div className="bg-navy-light border border-navy-lighter rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">船舶筛选</label>
            <select
              value={filter.ship_id}
              onChange={(e) => setFilter({ ...filter, ship_id: e.target.value })}
              className="w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical transition-colors"
            >
              <option value="">全部船舶</option>
              {ships.map((ship) => (
                <option key={ship.id} value={ship.id}>
                  {ship.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">检查类型</label>
            <select
              value={filter.inspection_type}
              onChange={(e) => setFilter({ ...filter, inspection_type: e.target.value })}
              className="w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical transition-colors"
            >
              <option value="">全部类型</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "bg-nautical text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-navy-lighter/50"
            )}
          >
            {tab.label}
            <span className="ml-1 text-xs opacity-70">
              ({tab.key === "all"
                ? inspections.length
                : inspections.filter((i) => i.inspectionResult === tab.key).length})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : filtered.length > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-3">
          {filtered.map((insp) => (
            <div
              key={insp.id}
              className="bg-navy-light border border-navy-lighter rounded-xl p-4 hover:border-gray-500 transition-colors cursor-pointer"
              onClick={() => navigate(`/inspections/${insp.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded font-medium",
                        resultColors[insp.inspectionResult]
                      )}
                    >
                      {resultLabels[insp.inspectionResult]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {typeLabels[insp.inspectionType] || insp.inspectionType}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-300">
                    <span className="flex items-center gap-1">
                      <Ship className="w-3.5 h-3.5 text-gray-500" />
                      {insp.shipName || getShipName(insp.shipId)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                      {insp.inspectorName || "未知"}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <Calendar className="w-3 h-3" />
                      {new Date(insp.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/inspections/${insp.id}`);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-navy-lighter/50 text-gray-400 hover:bg-navy-lighter hover:text-gray-200 rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  查看
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <CheckItem label="证书检查" value={insp.certificateCheck} />
                <CheckItem label="船员检查" value={insp.crewCheck} />
                <CheckItem label="货物检查" value={insp.cargoCheck} />
              </div>
              {insp.findings && (
                <div className="mt-2 text-xs text-gray-500 bg-navy/50 rounded p-2">
                  检查结果: {insp.findings}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">暂无临检记录</p>
          </div>
        </div>
      )}
    </div>
  );
}
