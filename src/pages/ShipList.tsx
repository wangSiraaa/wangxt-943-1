import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Ship as ShipIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  Anchor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useDataStore, type Ship } from "@/store/dataStore";

const shipTypes = [
  { value: "", label: "全部类型" },
  { value: "拖网渔船", label: "拖网渔船" },
  { value: "围网渔船", label: "围网渔船" },
  { value: "刺网渔船", label: "刺网渔船" },
  { value: "钓具渔船", label: "钓具渔船" },
  { value: "运输船", label: "运输船" },
  { value: "其他", label: "其他" },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Anchor }> = {
  in_port: { label: "在港", color: "text-port", icon: Anchor },
  at_sea: { label: "出海", color: "text-nautical-light", icon: ShipIcon },
  maintenance: { label: "维修", color: "text-warning", icon: Wrench },
};

export default function ShipList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { ships, fetchShips } = useDataStore();

  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        await fetchShips();
      } catch {
        console.error("获取船舶数据失败");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [fetchShips]);

  const filteredShips = useMemo(() => {
    return ships.filter((s) => {
      const matchName = !searchName || s.name.includes(searchName);
      const matchType = !filterType || s.type === filterType;
      return matchName && matchType;
    });
  }, [ships, searchName, filterType]);

  const isAdmin = user?.role === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-100">船舶档案</h1>
        {isAdmin && (
          <button
            onClick={() => navigate("/ships/new")}
            className="flex items-center gap-1.5 px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增船舶
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="搜索船名..."
            className="w-full bg-navy-light border border-navy-lighter rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-nautical"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-nautical"
        >
          {shipTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShips.map((ship) => {
          const st = statusConfig[ship.status] ?? {
            label: ship.status,
            color: "text-gray-400",
            icon: ShipIcon,
          };
          const StatusIcon = st.icon;

          return (
            <div
              key={ship.id}
              onClick={() => navigate(`/ships/${ship.id}`)}
              className="bg-navy-light border border-navy-lighter rounded-xl p-5 cursor-pointer hover:border-nautical/50 transition-all animate-fade-in"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-medium text-gray-100">
                    {ship.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ship.type}
                  </p>
                </div>
                <div className={cn("flex items-center gap-1.5", st.color)}>
                  <StatusIcon className="w-4 h-4" />
                  <span className="text-xs font-medium">{st.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <span className="text-xs text-gray-500">类型</span>
                  <p className="text-sm text-gray-300">{ship.type}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">吨位</span>
                  <p className="text-sm text-gray-300">{ship.tonnage}吨</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">船长</span>
                  <p className="text-sm text-gray-300">{ship.length}m</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">状态</span>
                  <p className="text-sm text-gray-300">{st.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredShips.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500">暂无匹配船舶</p>
        </div>
      )}
    </div>
  );
}
